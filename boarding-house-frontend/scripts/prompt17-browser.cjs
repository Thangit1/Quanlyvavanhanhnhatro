/* eslint-disable @typescript-eslint/no-require-imports */
// Native CDP + real HTTP and isolated synthetic MySQL. No API interception.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const ready = JSON.parse(
  fs.readFileSync("D:/DATN/prompt17-browser-ready.json", "utf8"),
);
assert.match(ready.api, /^http:\/\/127\.0\.0\.1:(?!8080\b)\d+\/api$/);
const out = path.resolve(__dirname, "../../docs/qa/prompt17");
fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:13000",
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket,
  seq = 0,
  current = "bootstrap",
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
    `location.pathname===${JSON.stringify(new URL(route, origin).pathname)}&&document.readyState==='complete'`,
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
    await fetch("http://127.0.0.1:9227/json/new?about:blank", {
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
  let room, contract, tenantEmail, tenantPhone;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  const end = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  async function setControl(title, value, tag = "input") {
    await evaluate(
      `(()=>{const label=Array.from(document.querySelectorAll('form label')).find(l=>l.textContent.toLowerCase().includes(${JSON.stringify(title.toLowerCase())}));const input=label?.querySelector(${JSON.stringify(tag)});if(!input)throw Error('Field missing: '+${JSON.stringify(title)});const prototype=${tag === "select" ? "HTMLSelectElement" : "HTMLInputElement"}.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await sleep(100);
  }
  async function uiLogin(role, email, password) {
    await command("Storage.clearDataForOrigin", {
      origin,
      storageTypes: "all",
    });
    await navigate("/login");
    await until(
      `!!document.querySelector('#email')&&!document.querySelector('#email').disabled`,
    );
    await evaluate(
      `document.querySelector('button[aria-haspopup=listbox]').click()`,
    );
    await until(`document.querySelectorAll('[role=option]').length>0`);
    await evaluate(
      `Array.from(document.querySelectorAll('[role=option]')).find(x=>x.textContent.includes(${JSON.stringify(role === "OWNER" ? "Chủ nhà" : "Khách thuê")})).click();document.querySelector('#email').focus()`,
    );
    await command("Input.insertText", { text: email });
    await evaluate(`document.querySelector('#password').focus()`);
    await command("Input.insertText", { text: password });
    await click("Đăng nhập ngay");
    await until(`location.pathname!=='/login'`, 90000);
  }
  async function confirmContract(label) {
    await until(
      `Array.from(document.querySelectorAll('summary')).some(s=>s.textContent.includes('Đọc đầy đủ nội dung hợp đồng'))`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('summary')).find(s=>s.textContent.includes('Đọc đầy đủ nội dung hợp đồng')).click()`,
    );
    await until(
      `Array.from(document.querySelectorAll('label')).some(l=>l.textContent.includes('Tôi đã mở')&&!l.querySelector('input')?.disabled)`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Tôi đã mở')).querySelector('input').click()`,
    );
    await click(label);
    await until(
      `document.body.innerText.includes('Bạn đã xác nhận hợp đồng cho phiên bản này.')`,
    );
  }
  await test("E2E01 four-step contract wizard provisions a tenant without leaving the form", async () => {
    const code = "B17-" + Date.now();
    const created = await api("/admin/rooms", "POST", {
      propertyId: property,
      code,
      name: "Browser17 synthetic room",
      monthlyRent: 1500000,
      depositAmount: 1000,
      capacity: 2,
      amenityIds: [],
      assets: [],
    });
    room = created.id;
    const d = await api("/admin/rooms/" + room);
    await api("/admin/rooms/" + room + "/status", "PATCH", {
      status: "READY",
      reason: "Synthetic QA room ready",
      version: d.room.version,
      readinessConfirmed: true,
    });
    tenantEmail = "browser17-" + Date.now() + "@test.invalid";
    tenantPhone = "09" + String(room + 1700).padStart(8, "0");
    await navigate(
      `/admin/contracts/new?propertyId=${property}&roomId=${room}`,
    );
    await until(
      `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Thêm người thuê mới')`,
    );
    await click("Thêm người thuê mới");
    await field("Họ và tên", "Browser17 synthetic tenant");
    await field("Số điện thoại", tenantPhone);
    await field("Email", tenantEmail);
    await click("Tiếp tục");
    await until(`document.body.innerText.includes('Ngày bắt đầu thuê')`);
    await setControl("Ngày bắt đầu thuê", today);
    await setControl("Ngày kết thúc thuê", end);
    await setControl("Ngày dự kiến nhận phòng", today);
    await setControl("Giá thuê", "1500000");
    await setControl("Tiền cọc", "1000");
    await evaluate(
      `Array.from(document.querySelectorAll('form select')).filter(s=>Array.from(s.options).some(o=>o.value==='METER')).forEach(s=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'FIXED');s.dispatchEvent(new Event('change',{bubbles:true}));})`,
    );
    await click("Tiếp tục");
    await until(
      `document.querySelector('form h2')?.textContent.includes('Xem trước hợp đồng')`,
    );
    await shot("wizard-preview-desktop");
    await click("Tiếp tục");
    await click("Tạo & gửi hợp đồng");
    await until(
      `location.pathname.startsWith('/admin/contracts/')&&Number.isInteger(Number(location.pathname.split('/').at(-1)))`,
      90000,
    );
    contract = Number((await evaluate("location.pathname")).split("/").at(-1));
    const detail = await api("/admin/contract-onboarding/" + contract);
    assert.equal(detail.draft.status, "PENDING_CONFIRMATION");
    assert.equal(detail.contractConfirmed, false);
    assert.equal(Number(detail.deposit.balance_amount), 0);
    await shot("created-contract");
  });
  let activationUrl;
  await test("E2E02 activation arrives through isolated Mailpit after contract commit", async () => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const list = await (
        await fetch(ready.mailpit + "/api/v1/messages")
      ).json();
      const message = list.messages.find(
        (m) =>
          m.Subject.includes("Kích hoạt") &&
          m.To.some((t) => t.Address === tenantEmail),
      );
      if (message) {
        const full = await (
          await fetch(ready.mailpit + "/api/v1/message/" + message.ID)
        ).json();
        activationUrl = full.Text.match(
          /https?:\/\/[^\s]+\/activate-account#token=[A-Za-z0-9_-]{43}/,
        )?.[0];
        if (activationUrl) break;
      }
      await sleep(300);
    }
    assert.ok(
      activationUrl,
      "Expected an activation email; message content intentionally not logged",
    );
  });
  await test(
    "E2E03 one-time setup removes token from URL and tenant logs in",
    async () => {
      await command("Storage.clearDataForOrigin", {
        origin,
        storageTypes: "all",
      });
      await command("Page.navigate", { url: activationUrl });
      await until(
        `location.pathname==='/activate-account'&&location.hash===''&&!!document.querySelector('input[aria-label="Mật khẩu mới"]')`,
      );
      await evaluate(
        `document.querySelector('input[aria-label="Mật khẩu mới"]').focus()`,
      );
      await command("Input.insertText", { text: ready.password });
      await evaluate(
        `document.querySelector('input[aria-label="Xác nhận mật khẩu"]').focus()`,
      );
      await command("Input.insertText", { text: ready.password });
      await click("Thiết lập mật khẩu");
      await until(
        `document.body.innerText.includes('Đã kích hoạt thông tin đăng nhập')`,
      );
      await shot("activation-complete");
      await uiLogin("TENANT", tenantEmail, ready.password);
      await navigate("/tenant/contracts/" + contract);
      await until(
        `document.body.innerText.includes('Đọc đầy đủ nội dung hợp đồng')`,
      );
      await shot("tenant-pending-contract");
    },
    [401],
  );
  await test("E2E04 tenant reads the version and explicitly confirms own contract", async () => {
    await confirmContract("Tôi đã đọc và đồng ý xác nhận hợp đồng");
    assert.equal(
      (await api("/admin/contract-onboarding/" + contract)).contractConfirmed,
      false,
    );
  });
  await test(
    "E2E05 landlord confirms the same version without activating occupancy",
    async () => {
      await uiLogin("OWNER", ready.email, ready.password);
      await navigate("/admin/contracts/" + contract);
      await confirmContract("Xác nhận hợp đồng");
      const detail = await api("/admin/contract-onboarding/" + contract);
      assert.equal(detail.contractConfirmed, true);
      assert.equal(detail.draft.status, "PENDING_CONFIRMATION");
    },
    [401],
  );
  await test("E2E06 accountant records one confirmed deposit; missing handover still blocks checkin", async () => {
    let detail = await api("/admin/contract-onboarding/" + contract);
    let profile = detail.identityProfile;
    await api(
      "/admin/contract-onboarding/" + contract + "/identity-profile",
      "PUT",
      {
        fullName: profile.full_name,
        dateOfBirth: "2000-01-01",
        phone: profile.phone,
        identityType: "CCCD",
        identityNumber: String(900000000000 + room),
        permanentAddress: "Browser17 synthetic permanent address",
        dataHash: profile.dataHash,
      },
    );
    detail = await api("/admin/contract-onboarding/" + contract);
    await api(
      "/admin/contract-onboarding/" + contract + "/identity-verification",
      "POST",
      {
        reference: "QA17 synthetic identity reviewed",
        documentsReviewed: true,
        dataHash: detail.identityProfile.dataHash,
      },
    );
    const deposits = await api("/admin/deposit-ledger");
    const deposit = deposits.find((d) => Number(d.contract_id) === contract);
    assert.ok(deposit);
    const login = await fetch(ready.api + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "p03-3@test.invalid",
        password: ready.password,
        requestedRole: "ACCOUNTANT",
      }),
    });
    assert.equal(login.status, 200);
    const accountant = (await login.json()).data.accessToken;
    const body = {
      amount: Number(deposit.required_amount),
      method: "CASH",
      occurredAt: new Date(Date.now() - 3000)
        .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
        .replace(" ", "T"),
      evidence: "QA17 synthetic cash receipt",
      reason: "QA17 accountant confirmed synthetic receipt",
      reconciled: false,
    };
    const key = crypto.randomUUID();
    for (let i = 0; i < 2; i++) {
      const r = await fetch(
        ready.api + "/accountant/deposit-ledger/" + deposit.id + "/collections",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accountant,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(body),
        },
      );
      assert.equal(r.status, 200);
    }
    detail = await api("/admin/contract-onboarding/" + contract);
    assert.equal(
      Number(detail.deposit.balance_amount),
      Number(deposit.required_amount),
    );
    assert.equal(detail.draft.status, "PENDING_CONFIRMATION");
    const checkin = await api("/admin/rental-lifecycle/checkins", "POST", {
      contractId: contract,
      scheduledDate: today,
      note: "Synthetic browser QA checkin",
    });
    let before = await api("/admin/contract-onboarding/" + contract);
    assert.equal(before.progress.canCompleteCheckin, false);
    await api("/admin/contract-onboarding/" + contract + "/handover", "PUT", {
      version: Number(before.checkin.version),
      scheduledDate: today,
      electricityReading: 0,
      waterReading: 0,
      keysCardsCount: 1,
      reference: "QA17 synthetic handover",
      confirmLandlord: true,
      expectedContextHash: before.handoverContextHash,
    });
    assert.ok(checkin.id);
  });
  await test(
    "E2E07 tenant confirms actual handover document then landlord completes checkin",
    async () => {
      await uiLogin("TENANT", tenantEmail, ready.password);
      await navigate("/tenant/contracts/" + contract);
      await until(
        `Array.from(document.querySelectorAll('label')).some(l=>l.textContent.includes('Tôi đã xem biên bản'))`,
      );
      await evaluate(
        `Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Tôi đã xem biên bản')).querySelector('input').click()`,
      );
      await click("Xác nhận biên bản người thuê");
      let detail;
      const end = Date.now() + 30000;
      while (Date.now() < end) {
        detail = await api("/admin/contract-onboarding/" + contract);
        if (detail.progress.handoverConfirmed) break;
        await sleep(200);
      }
      assert.equal(detail.progress.handoverConfirmed, true);
      await api(
        "/admin/rental-lifecycle/checkins/" + detail.checkin.id + "/complete",
        "POST",
        {
          identityVerified: true,
          contractVerified: true,
          depositVerified: true,
          electricityReading: 0,
          waterReading: 0,
          keysCardsCount: 1,
          note: "QA17 synthetic physical handover completed",
          policyBasedMeters: false,
          version: Number(detail.checkin.version),
        },
      );
      await navigate("/tenant/contracts/" + contract);
      await until(`document.body.innerText.includes('Đang hiệu lực')`);
      assert.equal((await api("/admin/rooms/" + room)).room.status, "OCCUPIED");
      await shot("tenant-active-contract-desktop");
    },
    [401],
  );
  await test("E2E08 refresh preserves progress and mobile has no horizontal overflow", async () => {
    await navigate("/tenant/contracts/" + contract);
    await until(`document.body.innerText.includes('Đang hiệu lực')`);
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await shot("tenant-active-contract-mobile");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
      true,
    );
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
          realMailpit: true,
          apiInterception: false,
        },
        null,
        2,
      ),
    );
    if (status === "PASS")
      fs.writeFileSync(
        "D:/DATN/prompt17-browser-complete.json",
        JSON.stringify({ runId: ready.runId, status }),
      );
    socket?.close();
    console.log("Browser " + status);
    process.exitCode = status === "PASS" ? 0 : 1;
  });
