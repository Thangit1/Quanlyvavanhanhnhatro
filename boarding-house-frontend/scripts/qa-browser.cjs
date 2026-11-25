/* eslint-disable @typescript-eslint/no-require-imports */
// Uses the installed Chromium DevTools protocol; no new test framework dependency.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ready = JSON.parse(
  fs.readFileSync("D:/DATN/prompt11-browser-ready.json", "utf8"),
);
const output = path.resolve(__dirname, "../../docs/qa/evidence");
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket,
  sequence = 0;
const pending = new Map();
const exceptions = [],
  consoleErrors = [],
  apiErrors = [],
  authChallenges = [],
  cases = [];
let browserVersion = "";
let current = "bootstrap";
async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error("CDP timeout " + method));
    }, 20000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject,
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result?.value;
}
async function until(expression, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await evaluate(expression)) return;
    } catch {}
    await sleep(150);
  }
  throw Error("Condition timed out: " + expression);
}
async function navigate(route) {
  await command("Page.navigate", { url: "http://127.0.0.1:13000" + route });
  await until("document.readyState==='complete'");
  await sleep(650);
}
async function type(selector, value) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await command("Input.insertText", { text: value });
}
async function screenshot(name) {
  const r = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(
    path.join(output, name + ".png"),
    Buffer.from(r.data, "base64"),
  );
}
async function test(name, fn) {
  current = name;
  const before = apiErrors.length,
    jsBefore = exceptions.length,
    consoleBefore = consoleErrors.length;
  let result = { id: name, status: "PASS" };
  try {
    await fn();
    await sleep(500);
    assert.equal(
      exceptions.length,
      jsBefore,
      "Unexpected JavaScript exception",
    );
    assert.equal(
      consoleErrors.length,
      consoleBefore,
      "Browser console error / possible hydration failure",
    );
    assert.equal(
      apiErrors.length,
      before,
      "Unexpected API response: " + JSON.stringify(apiErrors.slice(before)),
    );
    assert.equal(
      authChallenges.filter(
        (c) => c.case === name && !c.recovered && !c.teardown,
      ).length,
      0,
      "Unrecovered authentication challenge",
    );
  } catch (e) {
    result = {
      ...result,
      status: "FAIL",
      error: String(e.message).slice(0, 900),
    };
  }
  cases.push(result);
  console.log(name + ": " + result.status);
}
async function logout() {
  const menu = await evaluate(
    "!!document.querySelector('button[aria-haspopup=menu]')",
  );
  if (menu) {
    await evaluate(
      "document.querySelector('button[aria-haspopup=menu]').click()",
    );
    await sleep(200);
  }
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Đăng xuất'))?.click()",
  );
  await sleep(250);
  await evaluate(
    "Array.from(document.querySelectorAll('[role=dialog] button,[role=alertdialog] button')).find(b=>b.textContent.includes('Đăng xuất'))?.click()",
  );
  await until("location.pathname==='/login'");
}
async function main() {
  const tab = await (
    await fetch("http://127.0.0.1:19222/json/new?about:blank", {
      method: "PUT",
    })
  ).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) p.reject(Error(msg.error.message));
        else p.resolve(msg.result);
      }
      return;
    }
    if (msg.method === "Runtime.exceptionThrown")
      exceptions.push({
        case: current,
        message:
          msg.params.exceptionDetails.exception?.description?.slice(0, 600) ||
          msg.params.exceptionDetails.text,
      });
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    )
      consoleErrors.push({
        case: current,
        message: msg.params.args
          .map((a) =>
            typeof a.value === "string"
              ? a.value
              : (a.description?.split("\n")[0] ?? "Object"),
          )
          .join(" ")
          .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
          .replace(
            /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
            "[redacted JWT]",
          )
          .slice(0, 600),
      });
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.url.startsWith(ready.api) && r.status >= 200 && r.status < 300)
        for (const challenge of authChallenges)
          if (challenge.url === r.url) challenge.recovered = true;
      if (
        r.url.startsWith(ready.api) &&
        r.status === 401 &&
        !r.url.includes("/auth/refresh")
      )
        authChallenges.push({
          case: current,
          url: r.url,
          recovered: false,
          teardown: current.endsWith("-logout"),
        });
      if (r.url.startsWith(ready.api) && r.status >= 400 && r.status !== 401)
        apiErrors.push({ case: current, url: r.url, status: r.status });
    }
    if (msg.method === "Page.javascriptDialogOpening")
      void command("Page.handleJavaScriptDialog", { accept: true });
  };
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Network.enable");
  browserVersion = (await command("Browser.getVersion")).product;
  const roleIds = ["OWNER", "MANAGER", "ACCOUNTANT", "TECHNICIAN", "TENANT"];
  const routes = {
    OWNER: [
      "/owner/dashboard",
      "/admin/properties",
      `/admin/properties/${ready.propertyId}`,
      `/admin/rooms/${ready.roomId}`,
      "/admin/tenants",
      `/admin/invoices/${ready.invoiceId}`,
      "/admin/reports",
      "/admin/settings",
    ],
    MANAGER: [
      "/manager/dashboard",
      "/admin/properties",
      "/admin/invoices",
      "/admin/maintenance",
    ],
    ACCOUNTANT: [
      "/accountant/dashboard",
      "/accountant/invoices",
      "/accountant/payments",
      "/accountant/reports",
      "/accountant/periods",
    ],
    TECHNICIAN: [
      "/technician/dashboard",
      "/technician/tasks",
      `/technician/tasks/${ready.taskId}`,
      "/technician/account",
    ],
    TENANT: [
      "/tenant/home",
      "/tenant/contracts",
      `/tenant/contracts/${ready.contractId}`,
      "/tenant/invoices",
      `/tenant/invoices/${ready.invoiceId}`,
      "/tenant/maintenance",
      "/tenant/account",
    ],
  };
  for (const role of roleIds) {
    await test(role + "-login", async () => {
      await navigate("/login");
      await until(
        "!!document.querySelector('#email') && !document.querySelector('#email').disabled",
      );
      await evaluate(
        "document.querySelector('button[aria-haspopup=listbox]').click()",
      );
      await sleep(100);
      await evaluate(
        `document.querySelectorAll('[role=option]')[${roleIds.indexOf(role)}].click()`,
      );
      await type("#email", ready[role.toLowerCase() + "Email"]);
      await type("#password", ready.password);
      await evaluate("document.querySelector('button[type=submit]').click()");
      await until("location.pathname!=='/login'");
    });
    for (const route of routes[role])
      await test(role + " " + route, async () => {
        await navigate(route);
        await until("document.body.innerText.length>120");
        assert(
          !(await evaluate(
            "document.body.innerText.includes('Application error:')",
          )),
          "Application error rendered",
        );
        assert.equal(
          await evaluate("location.pathname"),
          route,
          "Unexpected guard/navigation redirect",
        );
      });
    if (role === "OWNER") {
      await test("OWNER Vietnamese cursor", async () => {
        await navigate("/admin/properties/new");
        const selected = await evaluate(
          "(()=>{let label=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Tên nhà trọ'));let input=label?.querySelector('input')||label?.parentElement.querySelector('input');if(!input)return false;input.setAttribute('data-qa-cursor','1');input.focus();return true;})()",
        );
        assert(selected, "Property name field exists");
        await command("Input.insertText", { text: "Nguyễn " });
        await command("Input.insertText", { text: "Thị QA" });
        assert.equal(
          await evaluate("document.querySelector('[data-qa-cursor]').value"),
          "Nguyễn Thị QA",
        );
        await screenshot("owner-vietnamese-input");
      });
    }
    await test(role + " mobile", async () => {
      await command("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await navigate(routes[role][0]);
      assert(
        await evaluate("document.documentElement.scrollWidth <= innerWidth+2"),
        "Root viewport overflow",
      );
      await screenshot(role.toLowerCase() + "-mobile");
      await command("Emulation.clearDeviceMetricsOverride");
    });
    await test(role + "-logout", logout);
  }
}
main()
  .catch((e) => {
    cases.push({
      id: current,
      status: "FAIL",
      error: String(e.message).slice(0, 900),
    });
  })
  .finally(() => {
    const result = {
      runId: ready.runId,
      status: cases.every((c) => c.status === "PASS") ? "PASS" : "FAIL",
      browser: "Installed Chromium via native CDP",
      browserVersion,
      cases,
      exceptions,
      consoleErrors,
      apiErrors,
      authChallenges,
    };
    fs.writeFileSync(
      path.join(output, "browser.json"),
      JSON.stringify(result, null, 2),
    );
    fs.writeFileSync(
      "D:/DATN/prompt11-browser-complete.json",
      JSON.stringify({ runId: ready.runId, status: result.status }),
    );
    socket?.close();
    console.log("Browser result: " + result.status);
    process.exitCode = result.status === "PASS" ? 0 : 1;
  });
