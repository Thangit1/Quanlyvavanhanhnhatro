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
  process.env.HANDOVER_BROWSER_PATH ||
  [
    "C:/Program Files/CocCoc/Browser/Application/browser.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => fs.existsSync(p));
if (!browserPath)
  throw new Error(
    "Set HANDOVER_BROWSER_PATH to a Chromium browser executable.",
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
  ["documents", "components/shared/handover-document.tsx"],
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
modules["@/providers/auth-provider"] =
  "exports.useAuth=()=>({user:window.fixtureUser})";
modules["@/services/api-client"] =
  "exports.apiClient={get:async()=>{throw Error('Unexpected live API access')}}";
modules["@/lib/api-error"] = "exports.apiErrorMessage=String";
modules["@tanstack/react-query"] =
  "exports.useQuery=opts=>({data:opts.queryKey[0]==='handover-history'?[{id:2,version:2,created_at:'2026-11-04',actor_name:'Owner'},{id:1,version:1,created_at:'2026-11-04',actor_name:'Owner'}]:Number(opts.queryKey.at(-1))===1?window.fixtureOld:window.fixtureLatest,isPending:false,isError:false})";
modules.entry = fs.readFileSync(
  path.join(__dirname, "handover-document-browser-fixture.cjs"),
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
async function run(name, fn) {
  await fn();
  cases.push(name);
}
(async () => {
  profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "handover-document-browser-"),
  );
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
  await run(
    "friendly Unicode document requires explicit consent for exactly the current version",
    async () => {
      const text = await evaluate(
        "document.querySelector('#root').textContent",
      );
      assert.ok(!text.includes("contract_id"));
      assert.ok(!text.includes("electricity_reading"));
      assert.ok(text.includes("E-NEW"));
      assert.ok(text.includes("kWh"));
      assert.ok(text.includes("Nguy\u1ec5n Th\u1ecb H\u00f2a \ud83c\udfe0"));
      assert.equal(
        await evaluate("document.querySelector('button.bg-blue-700').disabled"),
        true,
      );
      await evaluate("document.querySelector('input[type=checkbox]').click()");
      await pause(30);
      await evaluate("document.querySelector('button.bg-blue-700').click()");
      await pause(40);
      const requests = await evaluate("window.confirmationRequests");
      assert.equal(requests.length, 1);
      assert.equal(requests[0].version, 2);
      assert.equal(requests[0].contentHash, "b".repeat(64));
    },
  );
  await run(
    "restored content in a new version requires fresh consent",
    async () => {
      await evaluate("window.publishRestoredVersion()");
      await pause(30);
      assert.equal(
        await evaluate(
          "document.querySelector('input[type=checkbox]').checked",
        ),
        false,
      );
      assert.equal(
        await evaluate("document.querySelector('button.bg-blue-700').disabled"),
        true,
      );
    },
  );
  await run(
    "history and print show the selected snapshot and its own confirmations",
    async () => {
      await evaluate(
        "document.querySelector('#handover-preview > div button').click()",
      );
      await pause(30);
      await evaluate(
        "document.querySelectorAll('#handover-preview > div')[1].querySelectorAll('button')[2].click()",
      );
      await pause(40);
      const text = await evaluate(
        "document.querySelector('#root').textContent",
      );
      assert.ok(text.includes("E-OLD"));
      assert.ok(!text.includes("E-NEW"));
      assert.ok(!text.includes("contract_id"));
      assert.equal(
        await evaluate("document.querySelector('input[type=checkbox]')===null"),
        true,
      );
      await evaluate(
        "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('PDF')).click()",
      );
      await pause(30);
      const printed = await evaluate("window.printedText");
      assert.ok(printed.includes("BBBG-8-1"));
      assert.ok(printed.includes("E-OLD"));
      assert.ok(!printed.includes("E-NEW"));
    },
  );
  await run(
    "stale meter warning blocks consent and only authorized landlord gets update actions",
    async () => {
      await evaluate(
        "document.querySelectorAll('#handover-preview > div')[1].querySelector('button').click()",
      );
      await pause(30);
      await evaluate("window.changeMeter()");
      await pause(30);
      assert.equal(
        await evaluate("document.querySelector('input[type=checkbox]')===null"),
        true,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('a[href=\"#handover-editor\"]')===null",
        ),
        true,
      );
      await evaluate("window.switchOwner()");
      await pause(30);
      assert.equal(
        await evaluate(
          "document.querySelectorAll('a[href=\"#handover-editor\"]').length",
        ),
        2,
      );
      assert.equal(
        await evaluate("document.querySelector('details')!==null"),
        true,
      );
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
