/* eslint-disable @typescript-eslint/no-require-imports */
// Runs against the isolated Spring integration test. No application DB or personal browser profile.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const origin = "http://localhost:3109";
const email = process.env.AUTH_BROWSER_EMAIL;
const resetToken = process.env.AUTH_BROWSER_RESET_TOKEN;
assert.ok(
  email?.endsWith("@test.invalid") &&
    resetToken &&
    process.env.AUTH_BROWSER_BACKEND?.startsWith("http://127.0.0.1:"),
);
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "smarthome-auth-browser-"),
);
const output = fs.openSync(path.join(profile, "next.log"), "w");
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "localhost",
    "--port",
    "3109",
  ],
  {
    windowsHide: true,
    stdio: ["ignore", output, output],
    env: {
      ...process.env,
      NEXT_AUDIT_DIST_DIR: ".next-audit-auth",
      AUTH_PROXY_BACKEND_URL: process.env.AUTH_BROWSER_BACKEND,
      NODE_OPTIONS: "--max-old-space-size=384",
    },
  },
);
let browser,
  socket,
  stripCookies = false,
  sequence = 0;
const pending = new Map();
const network = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("CDP timeout: " + method));
    }, 20000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject,
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw Error("Browser evaluation failed");
  return result.result?.value;
}
async function until(expression) {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      /* navigation */
    }
    await sleep(100);
  }
  // Do not print URL/hash, form values, credentials, or reset token.
  const alert = await evaluate(
    "document.querySelector('[role=alert]')?.textContent || ''",
  );
  throw Error(
    "Browser condition did not complete: " +
      expression.replace(/#token=.*/, "[redacted]") +
      "; alert=" +
      alert,
  );
}
async function navigate(route) {
  await command("Page.navigate", { url: origin + route });
  await until("document.readyState === 'complete'");
}
async function fill(selector, value) {
  await evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function login(password) {
  await until(
    "document.querySelector('input[name=email]') && !document.querySelector('button[type=submit]')?.disabled",
  );
  await fill("input[name=email]", email);
  await fill("input[name=password]", password);
  await evaluate("document.querySelector('form').requestSubmit()");
  await until(
    "location.pathname.startsWith('/admin') || location.pathname.startsWith('/owner')",
  );
}
async function logout() {
  const status = await evaluate(
    `fetch('/api/backend/auth/logout',{method:'POST',credentials:'include',headers:{'X-Auth-Request':'1','Content-Type':'application/json'},body:'{}'}).then(r=>r.status)`,
  );
  assert.equal(status, 200);
  await navigate("/login");
  await until("!!document.querySelector('input[name=email]')");
}
async function paused(event) {
  if (!stripCookies || !event.responseStatusCode)
    return command("Fetch.continueRequest", { requestId: event.requestId });
  // Chrome can process Set-Cookie before pausing the response. Remove that side effect too.
  await command("Network.deleteCookies", {
    name: "refresh_token",
    url: origin + "/api/backend/auth/refresh",
    path: "/api/backend/auth",
  });
  const body = await command("Fetch.getResponseBody", {
    requestId: event.requestId,
  });
  await command("Fetch.fulfillRequest", {
    requestId: event.requestId,
    responseCode: event.responseStatusCode,
    responseHeaders: event.responseHeaders.filter(
      (header) =>
        ![
          "set-cookie",
          "content-encoding",
          "content-length",
          "transfer-encoding",
        ].includes(header.name.toLowerCase()),
    ),
    body: body.base64Encoded
      ? body.body
      : Buffer.from(body.body).toString("base64"),
  });
}
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + "/login")).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await sleep(200);
    }
    assert.ok(ready, "Production Next server did not start");
    browser = spawn(
      process.env.AUTH_BROWSER_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      [
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=0",
        "--test-third-party-cookie-phaseout",
        "--disable-gpu",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    let port;
    for (let i = 0; i < 100; i++) {
      try {
        port = fs
          .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0];
        if (port) break;
      } catch {
        /* startup */
      }
      await sleep(100);
    }
    assert.ok(port, "Chrome did not start");
    const targets = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    socket = new WebSocket(
      targets.find((target) => target.type === "page").webSocketDebuggerUrl,
    );
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const action = pending.get(message.id);
        pending.delete(message.id);
        if (action) {
          if (message.error) action.reject(Error(message.error.message));
          else action.resolve(message.result);
        }
      } else if (message.method === "Fetch.requestPaused")
        void paused(message.params).catch(() => {});
      else if (message.method === "Network.requestWillBeSent") {
        const route = new URL(message.params.request.url).pathname;
        if (route.endsWith("/auth/reset-password"))
          network.set(message.params.requestId, route);
      } else if (
        message.method === "Network.responseReceived" &&
        network.has(message.params.requestId)
      ) {
        console.log("Reset HTTP status:", message.params.response.status);
      } else if (
        message.method === "Network.loadingFailed" &&
        network.has(message.params.requestId)
      ) {
        console.log(
          "Reset network failure:",
          message.params.errorText,
          message.params.blockedReason || "",
          JSON.stringify(message.params.corsErrorStatus || {}),
        );
      }
    });
    await command("Page.enable");
    await command("Runtime.enable");
    await command("Network.enable");
    await navigate("/login");
    await login("Before-12345");
    await command("Page.reload");
    await until(
      "document.readyState === 'complete' && (location.pathname.startsWith('/admin') || location.pathname.startsWith('/owner'))",
    );
    await sleep(1500);
    assert.ok(await evaluate("!location.pathname.startsWith('/login')"));
    const cookies = await command("Network.getCookies", {
      urls: [origin + "/api/backend/auth/refresh"],
    });
    assert.ok(
      cookies.cookies.some(
        (cookie) =>
          cookie.name === "refresh_token" &&
          cookie.httpOnly &&
          cookie.secure &&
          cookie.path === "/api/backend/auth",
      ),
    );
    console.log(
      "PASS Chromium: real login, HttpOnly first-party cookie with third-party restriction, reload restores session",
    );
    await logout();
    console.log(
      "PASS Chromium: real logout removes cookie and returns to anonymous login",
    );
    await navigate("/reset-password#token=" + resetToken);
    await until(
      "!!document.querySelector('#new-password') && location.hash === '' && !document.querySelector('form button').disabled",
    );
    await fill("#new-password", "After-98765");
    await fill("#confirm-password", "After-98765");
    await evaluate("document.querySelector('form').requestSubmit()");
    await until(
      "document.body.innerText.includes('Đặt lại mật khẩu thành công')",
    );
    await navigate("/login");
    await login("After-98765");
    console.log(
      "PASS Chromium: reset page consumes email token, clears fragment, sets new password and signs in",
    );
    await logout();
    // Run CDP's cookie refusal simulation last so intercepted requests cannot affect the normal reset scenario.
    stripCookies = true;
    await command("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/backend/auth/*", requestStage: "Response" },
      ],
    });
    await login("After-98765");
    await until(
      "document.body.innerText.includes('Trình duyệt không gửi được cookie')",
    );
    await command("Page.reload");
    await until(
      "location.pathname === '/login' && !!document.querySelector('input[name=email]')",
    );
    console.log(
      "PASS Chromium: refusing Set-Cookie shows a session warning; reload returns to login without a refresh loop",
    );
    stripCookies = false;
    await command("Fetch.disable");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        await command("Browser.close");
      } catch {
        /* exit */
      }
      socket.close();
    }
    browser?.kill();
    next.kill();
    fs.closeSync(output);
    // Isolated browser profile is retained in OS temp for troubleshooting, never committed.
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
