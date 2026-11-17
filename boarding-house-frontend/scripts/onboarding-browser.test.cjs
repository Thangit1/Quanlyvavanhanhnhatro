/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated real React/browser fixture. Never connects to the application API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const browserPath =
  process.env.ONBOARDING_BROWSER_PATH ||
  [
    "C:/Program Files/CocCoc/Browser/Application/browser.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => fs.existsSync(p));
if (!browserPath)
  throw new Error(
    "Set ONBOARDING_BROWSER_PATH to a Chromium browser executable.",
  );
const readPackage = (name, file) =>
  fs.readFileSync(
    path.join(path.dirname(require.resolve(`${name}/package.json`)), file),
    "utf8",
  );
const modules = {
  react: readPackage("react", "cjs/react.production.js"),
  "react/jsx-runtime": readPackage(
    "react",
    "cjs/react-jsx-runtime.production.js",
  ),
  "react-dom": readPackage("react-dom", "cjs/react-dom.production.js"),
  "react-dom/client": readPackage(
    "react-dom",
    "cjs/react-dom-client.production.js",
  ),
  scheduler: readPackage("scheduler", "cjs/scheduler.production.js"),
};
for (const [name, file] of [
  ["@/lib/numeric-input", "lib/numeric-input.ts"],
  ["@/components/ui/number-input", "components/ui/number-input.tsx"],
  ["identity", "components/shared/onboarding-identity-profile.tsx"],
  ["handover", "components/shared/onboarding-handover-editor.tsx"],
  ["procedures", "components/shared/onboarding-procedures.tsx"],
]) {
  modules[name] = ts.transpileModule(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
}
modules["next/link"] =
  "const React=require('react');module.exports=function Link(p){return React.createElement('a',p,p.children)}";
modules["@/lib/format"] =
  "exports.formatDate=String;exports.formatCurrency=n=>String(n)+' VND';";
modules.entry = fs.readFileSync(
  path.join(__dirname, "onboarding-browser-fixture.cjs"),
  "utf8",
);
const definitions = Object.entries(modules)
  .map(
    ([name, source]) =>
      `${JSON.stringify(name)}:function(require,module,exports){${source}\n}`,
  )
  .join(",");
const bundle = `(()=>{const modules={${definitions}},cache={};function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Unknown module '+id);const m=cache[id]={exports:{}};modules[id](require,m,m.exports);return m.exports;}require('entry');})();`;
const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;margin:24px}label{display:block;margin:16px 0}input{display:block;padding:10px;width:220px}button{margin:8px;padding:10px}</style><div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let server, browser, socket, profile;
const cases = [],
  errors = [],
  pending = new Map();
let sequence = 0;
async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function insert(text) {
  await command("Input.insertText", { text });
  await pause(15);
}
async function run(name, fn) {
  await fn();
  cases.push(name);
}
(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-browser-"));
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(page);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let port;
  for (let i = 0; i < 100; i++) {
    const p = path.join(profile, "DevToolsActivePort");
    if (fs.existsSync(p)) {
      port = Number(fs.readFileSync(p, "utf8").split(/\r?\n/)[0]);
      break;
    }
    await pause(200);
  }
  if (!port) throw Error("Browser DevTools did not start");
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  socket = new WebSocket(
    (
      targets.find((t) => t.type === "page" && t.url === "about:blank") ||
      targets.find((t) => t.type === "page")
    ).webSocketDebuggerUrl,
  );
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const waiter = pending.get(data.id);
      pending.delete(data.id);
      if (waiter) {
        if (data.error) waiter.reject(Error(JSON.stringify(data.error)));
        else waiter.resolve(data.result);
      }
    } else if (data.method === "Runtime.exceptionThrown")
      errors.push(data.params);
  };
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.navigate", {
    url: `http://127.0.0.1:${server.address().port}`,
  });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("window.onboardingReady===true")) break;
    await pause(100);
  }
  assert.equal(await evaluate("window.onboardingReady===true"), true);
  // Included by onboarding-browser.test.cjs inside its async browser scenario.
  await run(
    "missing address has Vietnamese label; estimates do not mean paid",
    async () => {
      const body = await evaluate("document.body.textContent");
      assert.ok(body.includes("Địa chỉ thường trú"));
      assert.ok(body.includes("Chưa cập nhật"));
      assert.ok(body.includes("Không yêu cầu thanh toán trước"));
      assert.ok(body.includes("Chưa có hóa đơn đầu kỳ đã phát hành"));
      assert.equal(await evaluate("window.calls.length"), 0);
    },
  );
  await run(
    "update address inline keeps existing identity number",
    async () => {
      await evaluate(
        "document.querySelector('#identity-profile > button').click()",
      );
      await pause(30);
      await evaluate(
        "document.querySelector('[name=permanentAddress]').focus()",
      );
      await insert("Actual permanent address");
      await evaluate(
        "document.querySelector('#identity-profile form').requestSubmit()",
      );
      await pause(60);
      const call = (await evaluate("window.calls"))[0];
      assert.equal(call.path, "identity-profile");
      assert.equal(call.payload.permanentAddress, "Actual permanent address");
      assert.equal(call.payload.identityNumber, "");
      assert.equal(call.payload.phone, "0901234567");
      assert.equal(call.payload.dataHash, "a".repeat(64));
    },
  );
  await run(
    "verification requires actual review and current profile hash",
    async () => {
      await evaluate(
        "document.querySelectorAll('#identity-profile > button')[1].click()",
      );
      await pause(30);
      assert.equal(
        await evaluate(
          "document.querySelector('#identity-profile form button').disabled",
        ),
        true,
      );
      await evaluate(
        "document.querySelector('#identity-profile input[name=reference]').focus()",
      );
      await insert("ACTUAL-PROOF-01");
      await evaluate(
        "document.querySelector('#identity-profile input[type=checkbox]').click()",
      );
      await pause(20);
      await evaluate(
        "document.querySelector('#identity-profile form').requestSubmit()",
      );
      await pause(60);
      const call = (await evaluate("window.calls"))[1];
      assert.equal(call.path, "identity-verification");
      assert.equal(call.payload.documentsReviewed, true);
      assert.equal(call.payload.dataHash, "b".repeat(64));
      assert.equal(call.payload.reference, "ACTUAL-PROOF-01");
    },
  );
  await run(
    "handover validates real readings and previews all three steps",
    async () => {
      await evaluate(
        "document.querySelector('#handover-editor form').requestSubmit()",
      );
      await pause(40);
      assert.ok(
        (
          await evaluate(
            "document.querySelector('#handover-editor').textContent",
          )
        ).includes("E1250"),
      );
      await evaluate(
        "document.querySelector('#handover-editor form').requestSubmit()",
      );
      await pause(20);
      assert.equal(
        (await evaluate("window.calls")).filter((c) => c.path === "handover")
          .length,
        0,
      );
      for (const [name, text] of [
        ["ELECTRICITY", "1250"],
        ["WATER", "50"],
      ]) {
        await evaluate(`document.querySelector('#handover-${name}').focus()`);
        await insert(text);
      }
      await evaluate(
        "document.querySelector('#handover-editor input[name=handoverReference]').focus()",
      );
      await insert("ACTUAL-HANDOVER-01");
      await evaluate(
        "document.querySelector('#handover-editor form').requestSubmit()",
      );
      await pause(40);
      assert.ok(
        (
          await evaluate(
            "document.querySelector('#handover-editor').textContent",
          )
        ).includes("Actual desk"),
      );
      assert.equal(
        await evaluate(
          "document.querySelector('#handover-editor button[type=submit], #handover-editor button:not([type])').disabled",
        ),
        true,
      );
      await evaluate(
        "document.querySelector('#handover-editor input[type=checkbox]').click()",
      );
      await pause(20);
      await evaluate(
        "document.querySelector('#handover-editor form').requestSubmit()",
      );
      await pause(40);
      const call = (await evaluate("window.calls")).find(
        (c) => c.path === "handover",
      );
      assert.ok(call);
      assert.equal(call.payload.electricityReading, 1250);
      assert.equal(call.payload.waterReading, 50);
      assert.equal(call.payload.assets[0].conditionStatus, "GOOD");
      assert.equal(call.payload.reference, "ACTUAL-HANDOVER-01");
    },
  );

  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      { passed: cases.length, cases, browserErrors: errors.length },
      null,
      2,
    ),
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (socket) socket.close();
    if (browser) browser.kill();
    if (server)
      server.close(); /* Profile is retained in OS temp for browser shutdown; no recursive deletion. */
  });
