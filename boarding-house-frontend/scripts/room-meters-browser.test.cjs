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
  process.env.ROOM_METERS_BROWSER_PATH ||
  [
    "C:/Program Files/CocCoc/Browser/Application/browser.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => fs.existsSync(p));
if (!browserPath)
  throw new Error(
    "Set ROOM_METERS_BROWSER_PATH to a Chromium browser executable.",
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
  ["assets", "components/admin/properties/room-assets-editor.tsx"],
  ["management", "components/shared/room-meter-management.tsx"],
  [
    "./initial-room-meter-form",
    "components/shared/initial-room-meter-form.tsx",
  ],
  ["readiness", "components/shared/contract-meter-readiness.tsx"],
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
  "const React=require('react');function Link(p){return React.createElement('a',p,p.children)};Link.default=Link;module.exports=Link";
modules["@/lib/format"] =
  "exports.formatDate=String;exports.formatCurrency=n=>String(n)+' VND';";
modules["@/providers/auth-provider"] =
  "exports.useAuth=()=>({user:{id:1,activeRole:'OWNER'}})";
modules["@tanstack/react-query"] =
  "exports.useQueryClient=()=>({invalidateQueries:async()=>{await window.refreshMeters();}})";
modules["@/services/api-client"] =
  "exports.apiClient={post:async(path,payload)=>{window.calls.push({path,payload});return {};}}";
modules["@/lib/api-error"] = "exports.apiErrorMessage=String;";
modules["@/hooks/use-admin-properties"] =
  "exports.useAdminRoom=()=>({data:window.roomDetail})";
modules.entry = fs.readFileSync(
  path.join(__dirname, "room-meters-browser-fixture.cjs"),
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
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "room-meters-browser-"));
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
  assert.equal(
    await evaluate("window.onboardingReady===true"),
    true,
    JSON.stringify(errors),
  );
  // Included by onboarding-browser.test.cjs inside its async browser scenario.
  await run(
    "multiple assets can be edited and deleted without losing other rows",
    async () => {
      await evaluate(
        "document.querySelector('#assets-form button[type=button]').click()",
      );
      await pause(30);
      await evaluate(
        "document.querySelector('#assets-form input[maxlength=\"150\"]').focus()",
      );
      await insert("Desk");
      await evaluate("document.querySelector('#assets-form textarea').focus()");
      await insert("Actual desk photo reference");
      await evaluate(
        "document.querySelectorAll('#assets-form button[type=button]')[1].click()",
      );
      await pause(30);
      await evaluate(
        "document.querySelectorAll('#assets-form input[maxlength=\"150\"]')[1].focus()",
      );
      await insert("Chair");
      assert.equal((await evaluate("window.assetDrafts")).length, 2);
      await evaluate(
        "document.querySelectorAll('#assets-form select')[1].value='DAMAGED';document.querySelectorAll('#assets-form select')[1].dispatchEvent(new Event('change',{bubbles:true}))",
      );
      await pause(30);
      await evaluate(
        "document.querySelector('#assets-form button[type=button]').click()",
      );
      await pause(30);
      const remaining = await evaluate("window.assetDrafts");
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].name, "Chair");
      assert.equal(remaining[0].conditionStatus, "DAMAGED");
    },
  );
  await run(
    "installing each real meter refreshes cards and early contract warning",
    async () => {
      assert.equal(
        await evaluate("document.querySelectorAll('aside[role=alert]').length"),
        1,
      );
      for (const [type, code, reading] of [
        ["ELECTRICITY", "REAL-E1250", "1250"],
        ["WATER", "REAL-W50", "50"],
      ]) {
        await evaluate(
          "document.querySelector('#room-meters button[type=button]').click()",
        );
        await pause(30);
        await evaluate(
          "document.querySelector('#room-meters input[name=code]').focus()",
        );
        await insert(code);
        await evaluate(
          "document.querySelector('#room-meters input[inputmode]').focus()",
        );
        await insert(reading);
        await evaluate(
          "document.querySelector('#room-meters input[name=reference]').focus()",
        );
        await insert("ACTUAL-PROOF");
        await evaluate(
          "document.querySelector('#room-meters input[name=reason]').focus()",
        );
        await insert("Initial physical installation");
        await evaluate(
          "document.querySelector('#room-meters form').requestSubmit()",
        );
        await pause(60);
        const call = (await evaluate("window.calls")).at(-1);
        assert.equal(call.path, "/admin/rooms/9/meters");
        assert.equal(call.payload.type, type);
        assert.equal(call.payload.reading, Number(reading));
        assert.ok(
          (
            await evaluate("document.querySelector('#room-meters').textContent")
          ).includes(code),
        );
      }
      assert.equal(
        await evaluate("document.querySelectorAll('aside[role=alert]').length"),
        0,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('#room-meters button[type=button]')===null",
        ),
        true,
      );
      assert.equal((await evaluate("window.calls")).length, 2);
      assert.equal((await evaluate("window.assetDrafts"))[0].name, "Chair");
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
