/* eslint-disable @typescript-eslint/no-require-imports */
// Real read-only application screens on retained synthetic database. No API interception.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const accounts = JSON.parse(
  fs.readFileSync("D:/DATN/prompt11-browser-ready.json", "utf8"),
);
const phase = process.argv[2] || "after",
  origin = "http://127.0.0.1:13000",
  api = "http://127.0.0.1:18083/api";
const out = path.resolve(__dirname, "../../docs/qa/theme");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket,
  sequence = 0,
  current = "bootstrap",
  filePicker = false;
const pending = new Map(),
  cases = [],
  exceptions = [],
  responses = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence,
      timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("CDP timeout " + method));
      }, 30000);
    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
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
  if (r.exceptionDetails)
    throw Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result?.value;
}
async function until(expression) {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try {
      if (await evaluate("Boolean(" + expression + ")")) return;
    } catch {}
    await sleep(200);
  }
  throw Error("Timed out " + expression);
}
async function navigate(route) {
  await command("Page.navigate", { url: origin + route });
  await until(
    `location.pathname===${JSON.stringify(route)}&&document.readyState==='complete'`,
  );
  await sleep(800);
}
async function screenshot(name) {
  const r = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(
    path.join(out, phase + "-" + name + ".png"),
    Buffer.from(r.data, "base64"),
  );
}
async function test(name, fn) {
  current = name;
  const before = exceptions.length,
    start = responses.length;
  try {
    const result = await fn();
    assert.equal(
      exceptions.length,
      before,
      JSON.stringify(exceptions.slice(before)),
    );
    assert.ok(
      responses.slice(start).every((r) => r.status < 400 || r.status === 401),
      JSON.stringify(responses.slice(start).filter((r) => r.status >= 400)),
    );
    cases.push({ name, status: "PASS", ...result });
  } catch (e) {
    cases.push({ name, status: "FAIL", error: e.message });
  }
  console.log(name + ": " + cases.at(-1).status);
  if (cases.at(-1).error) console.log(cases.at(-1).error);
  fs.writeFileSync(
    path.join(out, phase + "-progress.json"),
    JSON.stringify({ cases, exceptions, responses }, null, 2),
  );
}
async function metrics() {
  return evaluate(
    `(()=>{const bg=el=>el?getComputedStyle(el).backgroundColor:null;const heading=Array.from(document.querySelectorAll('h2')).find(e=>e.textContent.includes('Ảnh đại diện'));const card=heading?.closest('section')||document.querySelector('main .surface-card')||document.querySelector('main article,main section');const menu=document.querySelector('[aria-current=page]');const label=document.querySelector('main label');return {page:bg(document.querySelector('main')?.closest('[class*=min-h-screen]')||document.body),body:bg(document.body),card:bg(card),cardBorder:card?getComputedStyle(card).borderColor:null,cardShadow:card?getComputedStyle(card).boxShadow:null,selected:bg(menu),selectedText:menu?getComputedStyle(menu).color:null,label:label?getComputedStyle(label).color:null,heading:heading?getComputedStyle(heading).fontSize:null,overflow:document.documentElement.scrollWidth>innerWidth+2};})()`,
  );
}
async function theme(dark) {
  await evaluate(
    `document.documentElement.classList.toggle('dark',${dark});document.documentElement.dataset.theme=${JSON.stringify(dark ? "dark" : "light")}`,
  );
  await sleep(350);
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
  socket.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result);
      }
      return;
    }
    if (m.method === "Page.fileChooserOpened") filePicker = true;
    if (m.method === "Runtime.exceptionThrown")
      exceptions.push({
        case: current,
        message:
          m.params.exceptionDetails.exception?.description ||
          m.params.exceptionDetails.text,
        url: m.params.exceptionDetails.url,
        line: m.params.exceptionDetails.lineNumber,
      });
    if (
      m.method === "Network.responseReceived" &&
      m.params.response.url.startsWith(api)
    )
      responses.push({
        case: current,
        url: m.params.response.url,
        status: m.params.response.status,
      });
    if (m.method === "Page.javascriptDialogOpening")
      void command("Page.handleJavaScriptDialog", { accept: true });
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.setInterceptFileChooserDialog", { enabled: true });
  await command("Page.bringToFront");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const routes = {
    TENANT: "/tenant/account/profile",
    OWNER: "/owner/dashboard",
    MANAGER: "/manager/dashboard",
    ACCOUNTANT: "/accountant/dashboard",
    TECHNICIAN: "/technician/dashboard",
  };
  for (const [role, route] of Object.entries(routes)) {
    await test(role + " authenticate fixture", async () => {
      await command("Network.clearBrowserCookies");
      await command("Storage.clearDataForOrigin", {
        origin,
        storageTypes: "all",
      });
      await navigate("/login");
      const email =
        role === "TENANT"
          ? accounts.tenantEmail
          : accounts[role.toLowerCase() + "Email"];
      const status = await evaluate(
        "fetch(" +
          JSON.stringify(api + "/auth/login") +
          ', {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(' +
          JSON.stringify({
            email,
            password: accounts.password,
            requestedRole: role,
          }) +
          ")}).then(r=>r.status)",
      );
      assert.equal(status, 200);
      await navigate(route);
      await until("document.querySelector('main h1,main h2')");
      await sleep(1200);
    });
    assert.equal(
      cases.at(-1).status,
      "PASS",
      role + " authentication must pass before visual checks",
    );
    await test(role + " light desktop", async () => {
      await theme(false);
      const result = await metrics();
      assert.equal(result.overflow, false);
      if (phase === "after") {
        assert.equal(result.body, "rgb(226, 234, 243)");
        assert.equal(result.card, "rgb(255, 255, 255)");
      }
      await screenshot(role.toLowerCase() + "-light");
      return { metrics: result };
    });
    await test(role + " dark desktop", async () => {
      await theme(true);
      const result = await metrics();
      assert.equal(result.overflow, false);
      if (phase === "after") {
        assert.notEqual(result.card, "rgb(255, 255, 255)");
        assert.notEqual(result.body, result.card);
      }
      await screenshot(role.toLowerCase() + "-dark");
      return { metrics: result };
    });
    if (role === "TENANT") {
      await test("Tenant profile focus and validation", async () => {
        await theme(false);
        const selector = await evaluate(
          `(()=>{const e=document.querySelector('main input[type=tel]');if(!e)return false;e.dataset.themeTest='phone';e.focus();e.select();return true;})()`,
        );
        assert.ok(selector);
        await command("Input.insertText", { text: "123" });
        await until("document.querySelector('[aria-invalid=true]')");
        await command("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
        });
        const focus = await evaluate(
          `(()=>{const e=document.activeElement;const s=getComputedStyle(e);return {tag:e.tagName,outline:s.outline,shadow:s.boxShadow};})()`,
        );
        await screenshot("tenant-focus");
        return { focus };
      });

      await test("Tenant menu selected and hover", async () => {
        await theme(false);
        const selected = await evaluate(
          "getComputedStyle(document.querySelector('nav[aria-label=\"Menu tài khoản\"] [aria-current=page]')).backgroundColor",
        );
        if (phase === "after") assert.equal(selected, "rgb(219, 232, 255)");
        const rect = await evaluate(
          '(()=>{const e=document.querySelector(\'nav[aria-label="Menu tài khoản"] a[href="/tenant/account/support"]\');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
        );
        await command("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          ...rect,
        });
        await sleep(250);
        const hover = await evaluate(
          'getComputedStyle(document.querySelector(\'nav[aria-label="Menu tài khoản"] a[href="/tenant/account/support"]\')).backgroundColor',
        );
        if (phase === "after") assert.equal(hover, "rgb(237, 242, 248)");
        return { selected, hover };
      });
      await test("Tenant avatar picker remains functional", async () => {
        filePicker = false;
        const rect = await evaluate(
          "(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Thay đổi ảnh'));b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",
        );
        await command("Input.dispatchMouseEvent", {
          type: "mousePressed",
          ...rect,
          button: "left",
          clickCount: 1,
        });
        await command("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          ...rect,
          button: "left",
          clickCount: 1,
        });
        await sleep(300);
        assert.ok(filePicker);
        const d = await command("DOM.getDocument");
        const n = await command("DOM.querySelector", {
          nodeId: d.root.nodeId,
          selector: "input[type=file]",
        });
        await command("DOM.setFileInputFiles", { nodeId: n.nodeId, files: [] });
        return { pickerOpened: true, uploadMutationPerformed: false };
      });
      await test("Tenant modal light and dark", async () => {
        await evaluate(
          "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Gửi yêu cầu cập nhật')).click()",
        );
        await until("document.querySelector('[role=dialog] section')");
        for (const dark of [false, true]) {
          await theme(dark);
          const bg = await evaluate(
            "getComputedStyle(document.querySelector('[role=dialog] section')).backgroundColor",
          );
          if (phase === "after")
            assert.equal(bg, dark ? "rgb(20, 32, 51)" : "rgb(255, 255, 255)");
          await screenshot("tenant-modal-" + (dark ? "dark" : "light"));
        }
        await evaluate(
          "Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent.trim()==='Hủy').click()",
        );
        await theme(false);
      });
      for (const width of [768, 390])
        await test("Tenant profile responsive " + width, async () => {
          await command("Emulation.setDeviceMetricsOverride", {
            width,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: width === 390,
          });
          assert.equal(
            await evaluate("document.documentElement.scrollWidth>innerWidth+2"),
            false,
          );
          await screenshot("tenant-" + width);
        });
      await test("Tenant drawer dark mobile", async () => {
        await theme(true);
        await evaluate(
          "document.querySelector('button[aria-label=\"Mở menu\"]').click()",
        );
        await until("document.querySelector('aside.relative')");
        const bg = await evaluate(
          "getComputedStyle(document.querySelector('aside.relative')).backgroundColor",
        );
        if (phase === "after") assert.equal(bg, "rgb(20, 32, 51)");
        await screenshot("tenant-drawer-dark");
        await evaluate(
          "Array.from(document.querySelectorAll('button[aria-label=\"Đóng menu\"]')).at(-1).click()",
        );
        await theme(false);
      });
      await command("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
    if (role === "OWNER")
      await test("Owner property table light and dark", async () => {
        await theme(false);
        await navigate("/admin/properties");
        await until(
          "Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Dạng bảng')",
        );
        await evaluate(
          "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Dạng bảng').click()",
        );
        await until("document.querySelector('table tbody tr')");
        for (const dark of [false, true]) {
          await theme(dark);
          await screenshot("owner-table-" + (dark ? "dark" : "light"));
        }
        return {
          rows: await evaluate(
            "document.querySelectorAll('table tbody tr').length",
          ),
        };
      });
    await theme(false);
  }
}
main()
  .catch((e) => cases.push({ name: current, status: "FAIL", error: e.message }))
  .finally(() => {
    const status =
      cases.length >= 15 && cases.every((c) => c.status === "PASS")
        ? "PASS"
        : "FAIL";
    fs.writeFileSync(
      path.join(out, phase + ".json"),
      JSON.stringify(
        {
          phase,
          status,
          cases,
          exceptions,
          responses,
          apiInterception: false,
          viewport: { width: 1440, height: 1000 },
        },
        null,
        2,
      ),
    );
    socket?.close();
    console.log(phase + " " + status);
    process.exitCode = status === "PASS" ? 0 : 1;
  });
