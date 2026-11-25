/* eslint-disable @typescript-eslint/no-require-imports */
// Native CDP + real HTTP and isolated synthetic MySQL. No API interception.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const ready = JSON.parse(
  fs.readFileSync("D:/DATN/prompt16-browser-ready.json", "utf8"),
);
assert.match(ready.api, /^http:\/\/127\.0\.0\.1:(?!8080\b)\d+\/api$/);
const out = path.resolve(__dirname, "../../docs/qa/room-images");
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
    files: (Array.isArray(name) ? name : [name]).map(
      (n) => "D:/DATN/prompt12-fixtures/" + n,
    ),
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
    await fetch("http://127.0.0.1:9226/json/new?about:blank", {
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
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
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
  let room, urls;
  const gallery = `document.querySelector('section[aria-label="Hình ảnh phòng"]')`;
  const count = `${gallery}?.querySelectorAll('article').length`;
  await test("TC01 native room file chooser", async () => {
    await navigate("/admin/rooms/new");
    await until(`!!document.querySelector('input[type=file]')`);
    await evaluate(
      `(()=>{const select=document.querySelector('form select');select.value=${property};select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await field("Mã phòng", "IMG-BROWSER-" + Date.now());
    await field("Tên phòng", "Phòng thử ảnh");
    await field("Giá thuê/tháng", "1500000");
    await click(
      "Nhấn để chọn ảnh hoặc kéo thả ảnh vào đâyHỗ trợ JPG, PNG, WEBP — tối đa 5 MB/ảnh, 10 ảnh/phòngChọn ảnh từ thiết bị",
    );
    await sleep(500);
    assert.ok(chooser);
  });
  await test("TC02 TC03 TC04 multiple local image previews before save", async () => {
    await file(["valid.png", "valid.jpeg", "valid.webp"]);
    await until(`${count}===3`);
    await until(
      `${gallery}.querySelectorAll('img').length>=3&&Array.from(${gallery}.querySelectorAll('img')).every(i=>i.complete&&i.naturalWidth>0)`,
    );
    await shot("preview-desktop");
    await evaluate(
      `${gallery}.querySelectorAll('article')[1].querySelector('button:not([disabled])').click()`,
    );
    // Select cover explicitly: the preview button above may open its viewer.
    await evaluate(
      `document.querySelector('dialog[open]')?.close();Array.from(${gallery}.querySelectorAll('article')[1].querySelectorAll('button')).find(b=>b.textContent.includes('Đặt làm')).click()`,
    );
    assert.equal(
      await evaluate(
        `${gallery}.querySelectorAll('article')[1].textContent.includes('Ảnh đại diện')`,
      ),
      true,
    );
    await evaluate(
      `${gallery}.querySelector('button[aria-label="Đưa ảnh 3 lên trước"]').click()`,
    );
  });
  await test("TC09 TC10 TC23 save once with multipart photographs", async () => {
    await click("Lưu phòng");
    await until(
      "location.pathname.startsWith('/admin/rooms/') && Number.isInteger(Number(location.pathname.split('/').at(-1)))",
      120000,
    );
    room = Number((await evaluate("location.pathname")).split("/").at(-1));
    const d = await api("/admin/rooms/" + room);
    urls = d.images;
    assert.equal(urls.length, 3);
    assert.equal(d.room.thumbnailUrl, urls[2]);
    await until(imageReady);
    await shot("detail-desktop");
  });
  await test("TC11 TC13 TC30 refresh and load persisted photographs", async () => {
    await navigate("/admin/rooms/" + room);
    await until(
      `document.querySelectorAll('section[aria-label="Thư viện ảnh phòng"] img').length>=4`,
    );
    await until(
      `Array.from(document.querySelectorAll('section[aria-label="Thư viện ảnh phòng"] img')).every(i=>i.complete&&i.naturalWidth>0)`,
    );
    const d = await api("/admin/rooms/" + room);
    assert.deepEqual(d.images, urls);
  });
  await test("TC14 TC15 TC16 TC17 edit cover order and remove after confirmation", async () => {
    await navigate("/admin/rooms/" + room + "/edit");
    await until(`${count}===3`);
    await evaluate(
      `Array.from(${gallery}.querySelectorAll('article')[0].querySelectorAll('button')).find(b=>b.textContent.includes('Đặt làm')).click()`,
    );
    await evaluate(
      `Array.from(${gallery}.querySelectorAll('article')[1].querySelectorAll('button')).find(b=>b.textContent==='Xóa').click()`,
    );
    await until(`${count}===2`);
    await click("Lưu phòng");
    await until(`location.pathname==='/admin/rooms/${room}'`, 120000);
    const d = await api("/admin/rooms/" + room);
    assert.equal(d.images.length, 2);
    assert.equal(d.room.thumbnailUrl, d.images[0]);
    urls = d.images;
  });
  await test("TC05 TC06 TC07 TC08 reject oversized fake unsupported and excessive selections", async () => {
    await navigate("/admin/rooms/" + room + "/edit");
    await until(`${count}===2`);
    await file("large.png");
    await until(
      `${gallery}.querySelector('[role=alert]')?.textContent.includes('5MB')`,
    );
    await file("unsafe.svg");
    await until(
      `${gallery}.querySelector('[role=alert]')?.textContent.includes('Chỉ hỗ trợ')`,
    );
    await file("fake.jpg");
    await until(`!!${gallery}.querySelector('[role=alert]')`);
    await file(Array(9).fill("valid.png"));
    await until(
      `${gallery}.querySelector('[role=alert]')?.textContent.includes('10 ảnh')`,
    );
    assert.equal(await evaluate(count), 2);
    assert.deepEqual((await api("/admin/rooms/" + room)).images, urls);
  });
  await test("fullscreen next previous and responsive gallery", async () => {
    await navigate("/admin/rooms/" + room);
    await until(imageReady);
    await click("Xem toàn màn hình");
    await until(`!!document.querySelector('dialog[open]')`);
    await click("Sau →");
    await until(
      `document.querySelector('dialog[open]').textContent.includes('2/2')`,
    );
    await click("← Trước");
    await click("Đóng");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await shot("detail-mobile");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth+1"),
      true,
    );
    await command("Emulation.clearDeviceMetricsOverride");
  });
  await test("TC12 card list displays saved cover", async () => {
    await navigate("/admin/rooms");
    await until(`!!document.querySelector('a[href="/admin/rooms/${room}"]')`);
    await until(imageReady);
    await shot("room-list");
  });
}
main()
  .catch((e) => {
    cases.push({ name: "fatal", status: "FAIL", error: e.message });
    console.error(e.message);
  })
  .finally(() => {
    const status =
      cases.length > 0 && cases.every((c) => c.status === "PASS")
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
      "D:/DATN/prompt16-browser-complete.json",
      JSON.stringify({ runId: ready.runId, status }),
    );
    socket?.close();
    console.log("Browser " + status);
    process.exitCode = status === "PASS" ? 0 : 1;
  });
