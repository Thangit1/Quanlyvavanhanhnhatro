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
  process.env.NUMERIC_BROWSER_PATH ||
  [
    "C:/Program Files/CocCoc/Browser/Application/browser.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => fs.existsSync(p));
if (!browserPath)
  throw new Error("Set NUMERIC_BROWSER_PATH to a Chromium browser executable.");
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
  ["inputs", "components/ui/number-input.tsx"],
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
modules.entry = `const React=require('react'),{createRoot}=require('react-dom/client'),{CurrencyInput,DecimalInput,IntegerInput,FormInput}=require('inputs'),{requiredNumericValue}=require('@/lib/numeric-input');
function App(){const [money,setMoney]=React.useState('0'),[decimal,setDecimal]=React.useState('0'),[integer,setInteger]=React.useState('0');React.useEffect(()=>{window.numericReady=true;});window.drafts=()=>({money,decimal,integer});return React.createElement('form',{id:'fixture',onSubmit:e=>{e.preventDefault();const f=new FormData(e.currentTarget);window.lastPayload={money:requiredNumericValue(f.get('money')),decimal:requiredNumericValue(f.get('decimal')),integer:requiredNumericValue(f.get('integer')),uncontrolled:requiredNumericValue(f.get('uncontrolled')),phone:f.get('phone')};}},
React.createElement('label',null,'Money',React.createElement(CurrencyInput,{id:'money',name:'money',required:true,value:money,onValueChange:setMoney})),
React.createElement('label',null,'Decimal',React.createElement(DecimalInput,{id:'decimal',name:'decimal',min:0,required:true,value:decimal,onValueChange:setDecimal})),
React.createElement('label',null,'Integer',React.createElement(IntegerInput,{id:'integer',name:'integer',min:0,max:100,required:true,value:integer,onValueChange:setInteger})),
React.createElement('label',null,'Uncontrolled',React.createElement(CurrencyInput,{id:'uncontrolled',name:'uncontrolled',defaultValue:0,required:true})),
React.createElement(FormInput,{id:'phone',name:'phone',type:'tel',defaultValue:'0900123456'}),
React.createElement('button',{id:'save',type:'submit'},'Save'),React.createElement('button',{id:'reset',type:'reset'},'Reset'));}createRoot(document.getElementById('root')).render(React.createElement(App));`;
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
async function focus(id, select = false) {
  await evaluate(`document.getElementById(${JSON.stringify(id)}).focus()`);
  await pause(30);
  if (select)
    await evaluate(`document.getElementById(${JSON.stringify(id)}).select()`);
}
const value = (id) =>
  evaluate(`document.getElementById(${JSON.stringify(id)}).value`);
async function insert(text) {
  await command("Input.insertText", { text });
  await pause(15);
}
async function clear(id) {
  await focus(id, true);
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
  });
  await pause(20);
}
async function run(name, fn) {
  await fn();
  cases.push(name);
}
(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "numeric-input-browser-"));
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
    if (await evaluate("window.numericReady===true")) break;
    await pause(100);
  }
  assert.equal(await evaluate("window.numericReady===true"), true);
  await run("focus zero replaces it without a leading zero", async () => {
    await focus("money");
    for (const digit of "3500000") await insert(digit);
    assert.equal(await value("money"), "3500000");
  });
  await run(
    "clearing stays blank and required validation blocks submission",
    async () => {
      await clear("money");
      assert.equal(await value("money"), "");
      assert.equal((await evaluate("window.drafts()")).money, "");
      await evaluate("document.getElementById('fixture').requestSubmit()");
      assert.equal(await evaluate("window.lastPayload===undefined"), true);
    },
  );
  await run(
    "zero is preserved and leading zeroes normalize only on blur",
    async () => {
      await insert("0");
      assert.equal(await value("money"), "0");
      await focus("money", true);
      await insert("0003500000");
      assert.equal(await value("money"), "0003500000");
      await focus("phone");
      assert.equal(await value("money"), "3.500.000");
      assert.equal((await evaluate("window.drafts()")).money, "3500000");
    },
  );
  await run("intermediate decimals retain the separator", async () => {
    await focus("decimal");
    await insert("0");
    await insert(".");
    assert.equal(await value("decimal"), "0.");
    await insert("5");
    assert.equal(await value("decimal"), "0.5");
    await clear("decimal");
    await insert("1");
    await insert(".");
    assert.equal(await value("decimal"), "1.");
    await insert("25");
    assert.equal(await value("decimal"), "1.25");
  });
  await run(
    "Vietnamese grouped currency paste keeps the exact amount",
    async () => {
      await focus("money", true);
      await evaluate(
        "(()=>{const d=new DataTransfer();d.setData('text/plain','3.500.000');document.getElementById('money').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));})()",
      );
      await pause(30);
      assert.equal(await value("money"), "3500000");
    },
  );
  await run(
    "editing in the middle retains focus, the DOM node and caret",
    async () => {
      await focus("money", true);
      await insert("3500000");
      await evaluate(
        "window.originalInput=document.getElementById('money');window.originalInput.setSelectionRange(2,2)",
      );
      await insert("9");
      assert.equal(await value("money"), "35900000");
      assert.equal(
        await evaluate(
          "document.activeElement===window.originalInput && document.getElementById('money')===window.originalInput && window.originalInput.selectionStart===3",
        ),
        true,
      );
    },
  );
  await run(
    "mouse focus on a formatted amount keeps the clicked caret position",
    async () => {
      await focus("phone");
      const rect = await evaluate(
        "(()=>{const n=document.getElementById('money');n.style.font='16px monospace';const r=n.getBoundingClientRect();return {x:r.x+32,y:r.y+r.height/2};})()",
      );
      await command("Input.dispatchMouseEvent", {
        type: "mousePressed",
        button: "left",
        clickCount: 1,
        ...rect,
      });
      await command("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        button: "left",
        clickCount: 1,
        ...rect,
      });
      await pause(50);
      assert.ok(
        await evaluate(
          "document.getElementById('money').selectionStart < document.getElementById('money').value.length",
        ),
      );
    },
  );
  await run(
    "integers reject decimals, negative signs and nonnumeric characters",
    async () => {
      await focus("integer");
      await insert("3");
      await insert(".");
      await insert("e");
      await insert("-");
      assert.equal(await value("integer"), "3");
    },
  );
  await run(
    "FormData and submitted JSON contain numbers without grouping",
    async () => {
      await focus("save");
      await evaluate("document.getElementById('fixture').requestSubmit()");
      const payload = await evaluate("window.lastPayload");
      assert.equal(payload.money, 35900000);
      assert.equal(typeof payload.money, "number");
      assert.equal(payload.decimal, 1.25);
      assert.equal(payload.phone, "0900123456");
      assert.equal(payload.uncontrolled, 0);
    },
  );
  await run(
    "uncontrolled numeric inputs participate in native form reset",
    async () => {
      await focus("uncontrolled");
      await insert("123");
      await evaluate(
        "HTMLFormElement.prototype.reset.call(document.getElementById('fixture'))",
      );
      await pause(30);
      assert.equal(await value("uncontrolled"), "0");
    },
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true });
  await run("touch focus replaces zero on a mobile viewport", async () => {
    await focus("phone");
    const rect = await evaluate(
      "(()=>{const n=document.getElementById('uncontrolled');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",
    );
    await command("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [rect],
    });
    await command("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await pause(60);
    await insert("45");
    assert.equal(await value("uncontrolled"), "45");
  });
  await run(
    "mobile inputs expose numeric and decimal keyboards and preserve editing",
    async () => {
      assert.equal(
        await evaluate("document.getElementById('integer').inputMode"),
        "numeric",
      );
      assert.equal(
        await evaluate("document.getElementById('decimal').inputMode"),
        "decimal",
      );
      await clear("money");
      await insert("0.5");
      assert.equal(await value("money"), "0.5");
      await focus("phone");
      assert.equal(await value("money"), "0,5");
      await clear("decimal");
      await insert("0,5");
      assert.equal(await value("decimal"), "0.5");
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
