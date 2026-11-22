/* eslint-disable @typescript-eslint/no-require-imports */
// Native CDP + real HTTP and isolated synthetic MySQL. No API interception.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const ready = JSON.parse(
  fs.readFileSync("D:/DATN/prompt12-browser-ready.json", "utf8"),
);
assert.match(ready.api, /^http:\/\/127\.0\.0\.1:(?!8080\b)\d+\/api$/);
const out = path.resolve(__dirname, "../../docs/qa/property-images");
fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:13000",
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket,
  seq = 0,
  current = "bootstrap",
  chooser = false,
  token,
  property = ready.propertyId;
const pending = new Map(),
  cases = [],
  errors = [],
  responses = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
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
async function until(expression, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await evaluate(expression)) return;
    } catch {}
    await sleep(200);
  }
  throw Error("Timed out: " + expression);
}
async function navigate(route) {
  await command("Page.navigate", { url: origin + route });
  await until(
    `location.pathname===${JSON.stringify(route)}&&document.readyState==='complete'`,
  );
  await sleep(700);
}
async function click(text) {
  const rect = await evaluate(
    `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}&&b.getClientRects().length&&!b.disabled);if(!b)throw Error('Button missing');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
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
}
async function file(name) {
  const doc = await command("DOM.getDocument");
  const node = await command("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: "input[type=file]",
  });
  await command("DOM.setFileInputFiles", {
    nodeId: node.nodeId,
    files: ["D:/DATN/prompt12-fixtures/" + name],
  });
}
async function field(label, value) {
  await evaluate(
    `(()=>{const label=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes(${JSON.stringify(label)}));const input=label?.querySelector('input');if(!input)throw Error('Field missing');input.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await command("Input.insertText", { text: value });
}
async function api(url, method = "GET", body) {
  const r = await fetch(ready.api + url, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, method + " " + url + ": " + r.status);
  return data.data;
}
const imageReady = `Array.from(document.querySelectorAll('img')).some(i=>i.alt.startsWith('Ảnh')&&i.complete&&i.naturalWidth>0)`;
async function edit() {
  await navigate("/admin/properties/" + property + "/edit");
  await until(`!!document.querySelector('input[type=file]')`);
}
async function save() {
  await click("Lưu nhà trọ");
  await until(`location.pathname==='/admin/properties/${property}'`);
  await until(imageReady);
}
async function shot(name) {
  const r = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(
    path.join(out, name + ".png"),
    Buffer.from(r.data, "base64"),
  );
}
async function test(name, fn, expected = []) {
  current = name;
  const before = errors.length,
    start = responses.length;
  try {
    await fn();
    await sleep(300);
    assert.equal(errors.length, before, JSON.stringify(errors.slice(before)));
    assert.ok(
      responses
        .slice(start)
        .every((r) => r.status < 400 || expected.includes(r.status)),
      JSON.stringify(responses.slice(start).filter((r) => r.status >= 400)),
    );
    cases.push({ name, status: "PASS" });
  } catch (e) {
    cases.push({ name, status: "FAIL", error: e.message });
  }
  fs.writeFileSync(
    path.join(out, "browser-progress.json"),
    JSON.stringify({ runId: ready.runId, cases, errors, responses }, null, 2),
  );
  console.log(name + ": " + cases.at(-1).status);
  if (cases.at(-1).error) console.log(cases.at(-1).error);
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
    if (m.method === "Page.fileChooserOpened") chooser = true;
    if (m.method === "Page.javascriptDialogOpening")
      void command("Page.handleJavaScriptDialog", { accept: true });
    if (m.method === "Runtime.exceptionThrown")
      errors.push({
        case: current,
        message:
          m.params.exceptionDetails.exception?.description ||
          m.params.exceptionDetails.text,
      });
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      errors.push({
        case: current,
        message: m.params.args
          .map((a) => a.value || a.description)
          .join(" ")
          .slice(0, 500),
      });
    if (
      m.method === "Network.responseReceived" &&
      m.params.response.url.startsWith(ready.api)
    )
      responses.push({
        case: current,
        url: m.params.response.url,
        status: m.params.response.status,
      });
  };
  await command("Page.bringToFront");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Runtime.enable");
  await command("Page.enable");
  await command("DOM.enable");
  await command("Network.enable");
  await command("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
  await command("Page.setInterceptFileChooserDialog", { enabled: true });
  const login = await fetch(ready.api + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ready.email,
      password: ready.password,
      requestedRole: "OWNER",
    }),
  });
  assert.equal(login.status, 200);
  token = (await login.json()).data.accessToken;
  await test(
    "Login real owner",
    async () => {
      await navigate("/login");
      await until(
        `!!document.querySelector('#email')&&!document.querySelector('#email').disabled`,
      );
      await evaluate(
        `document.querySelector('button[aria-haspopup=listbox]').click()`,
      );
      await until(`document.querySelectorAll('[role=option]').length>0`);
      await evaluate(
        `document.querySelectorAll('[role=option]')[0].click();document.querySelector('#email').focus()`,
      );
      await command("Input.insertText", { text: ready.email });
      await evaluate(`document.querySelector('#password').focus()`);
      await command("Input.insertText", { text: ready.password });
      await click("\u0110\u0103ng nh\u1eadp ngay");
      await until(`location.pathname!=='/login'`, 120000);
    },
    [401],
  );
  let old = (await api("/admin/properties/" + property)).thumbnailUrl;
  await test("TC01 native file chooser", async () => {
    await edit();
    await until(imageReady);
    await click("Thay ảnh");
    await sleep(300);
    assert.ok(chooser);
  });
  await test("TC03 TC05 PNG preview before upload", async () => {
    await file("valid.png");
    await until(`document.body.innerText.includes('valid.png')`);
    await until(imageReady);
    assert.equal(
      (await api("/admin/properties/" + property)).thumbnailUrl,
      old,
    );
    await shot("preview-desktop");
  });
  await test("View large and cancel selection", async () => {
    await click("Xem ảnh");
    await until(`!!document.querySelector('dialog[open]')`);
    await click("Đóng");
    await click("Hủy lựa chọn");
    assert.equal(
      (await api("/admin/properties/" + property)).thumbnailUrl,
      old,
    );
  });
  await test("TC08 fake JPG rejected", async () => {
    await file("fake.jpg");
    await until(
      `document.querySelector('[role=alert]')?.textContent.includes('không phải ảnh')`,
    );
    assert.equal(
      (await api("/admin/properties/" + property)).thumbnailUrl,
      old,
    );
  });
  await test("TC06 oversize rejected", async () => {
    await file("large.png");
    await until(
      `document.querySelector('[role=alert]')?.textContent.includes('5MB')`,
    );
  });
  await test("TC07 SVG rejected", async () => {
    await file("unsafe.svg");
    await until(
      `document.querySelector('[role=alert]')?.textContent.includes('Chỉ hỗ trợ')`,
    );
  });
  await test("TC09 TC10 save actual multipart PNG", async () => {
    await file("valid.png");
    await until(`document.body.innerText.includes('valid.png')`);
    await save();
    const stored = (await api("/admin/properties/" + property)).thumbnailUrl;
    assert.notEqual(stored, old);
    old = stored;
  });
  await test("TC11 TC13 reload detail persists image", async () => {
    await navigate("/admin/properties/" + property);
    await until(imageReady);
    assert.equal(
      (await api("/admin/properties/" + property)).thumbnailUrl,
      old,
    );
    await shot("saved-detail");
  });
  await test("TC12 list displays stored thumbnail", async () => {
    await navigate("/admin/properties");
    await until(imageReady);
    await shot("saved-list");
  });
  await test("TC04 drag and drop WEBP", async () => {
    await edit();
    const b64 = fs
      .readFileSync("D:/DATN/prompt12-fixtures/valid.webp")
      .toString("base64");
    await evaluate(
      `(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(b64)}),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'dropped.webp',{type:'image/webp'}));document.querySelector('section[aria-label="Ảnh đại diện nhà trọ"] div').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));})()`,
    );
    await until(`document.body.innerText.includes('dropped.webp')`);
  });
  await test(
    "TC15 TC22 stale save fails and keeps old image",
    async () => {
      const p = await api("/admin/properties/" + property);
      await api("/admin/properties/" + property, "PUT", {
        code: p.propertyCode,
        name: p.name,
        type: p.type,
        address: p.address,
        description: p.description,
        phone: p.phone,
        email: p.email,
        operationStartDate: p.operationStartDate,
        thumbnailUrl: p.thumbnailUrl,
        version: p.version,
      });
      await click("Lưu nhà trọ");
      await until(`document.body.innerText.includes('đã thay đổi')`);
      assert.equal(
        (await api("/admin/properties/" + property)).thumbnailUrl,
        old,
      );
      assert.equal(
        await evaluate("location.pathname"),
        "/admin/properties/" + property + "/edit",
      );
    },
    [409],
  );
  await test("TC02 TC14 replace JPEG successfully", async () => {
    await edit();
    await file("valid.jpeg");
    await until(`document.body.innerText.includes('valid.jpeg')`);
    await save();
    const stored = (await api("/admin/properties/" + property)).thumbnailUrl;
    assert.notEqual(stored, old);
    old = stored;
  });
  await test("TC29 mobile form fits viewport", async () => {
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await edit();
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),
    );
    await shot("edit-mobile");
    await command("Emulation.clearDeviceMetricsOverride");
  });
  await test("TC16 remove only on save", async () => {
    await edit();
    await click("Xóa ảnh");
    assert.equal(
      (await api("/admin/properties/" + property)).thumbnailUrl,
      old,
    );
    await click("Lưu nhà trọ");
    await until(`location.pathname==='/admin/properties/${property}'`);
    assert.ok(!(await api("/admin/properties/" + property)).thumbnailUrl);
    await navigate("/admin/properties/" + property);
    await until(
      `!!document.querySelector('[aria-label="Chưa có ảnh nhà trọ"]')`,
    );
  });
  await test("Create house with image in one save", async () => {
    await navigate("/admin/properties/new");
    await until(`!!document.querySelector('input[type=file]')`);
    await field("Mã nhà trọ", "QA_BROWSER_" + Date.now());
    await field("Tên nhà trọ", "Browser image house");
    await field("Địa chỉ", "Synthetic browser address");
    await file("valid.webp");
    await until(`document.body.innerText.includes('valid.webp')`);
    await click("Lưu nhà trọ");
    await until(`/^\\/admin\\/properties\\/\\d+$/.test(location.pathname)`);
    property = Number((await evaluate("location.pathname")).split("/").at(-1));
    const saved = await api("/admin/properties/" + property);
    assert.equal(saved.name, "Browser image house");
    assert.ok(saved.thumbnailUrl);
    await until(imageReady);
  });
  await test(
    "TC23 fresh login still displays image",
    async () => {
      await evaluate(
        `Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-haspopup')==='menu')?.click()`,
      );
      await sleep(200);
      await click("Đăng xuất");
      await sleep(200);
      await evaluate(
        `Array.from(document.querySelectorAll('[role=dialog] button,[role=alertdialog] button')).find(b=>b.textContent.trim()==='Đăng xuất')?.click()`,
      );
      await until(`location.pathname==='/login'`);
      await until(`!!document.querySelector('#email')`);
      await evaluate(
        `document.querySelector('button[aria-haspopup=listbox]').click()`,
      );
      await until(`document.querySelectorAll('[role=option]').length>0`);
      await evaluate(
        `document.querySelectorAll('[role=option]')[0].click();document.querySelector('#email').focus()`,
      );
      await command("Input.insertText", { text: ready.email });
      await evaluate(`document.querySelector('#password').focus()`);
      await command("Input.insertText", { text: ready.password });
      await click("\u0110\u0103ng nh\u1eadp ngay");
      await until(`location.pathname!=='/login'`, 120000);
      await navigate("/admin/properties/" + property);
      await until(imageReady);
    },
    [401],
  );
}
main()
  .catch((e) => {
    cases.push({ name: current, status: "FAIL", error: e.message });
  })
  .finally(() => {
    const status =
      cases.length > 10 && cases.every((c) => c.status === "PASS")
        ? "PASS"
        : "FAIL";
    fs.writeFileSync(
      path.join(out, "browser.json"),
      JSON.stringify(
        {
          runId: ready.runId,
          status,
          cases,
          errors,
          responses,
          apiInterception: false,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      "D:/DATN/prompt12-browser-complete.json",
      JSON.stringify({ runId: ready.runId, status }),
    );
    socket?.close();
    console.log("Browser " + status);
    process.exitCode = status === "PASS" ? 0 : 1;
  });
