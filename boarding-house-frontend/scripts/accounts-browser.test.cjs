/* eslint-disable @typescript-eslint/no-require-imports */
// Real production Next.js/React UI; CDP intercepts every API call with isolated in-memory fixtures.
// The application database and existing browser profiles are never accessed.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const origin = process.env.ACCOUNTS_BROWSER_ORIGIN || "http://localhost:3105";
const browser =
  process.env.ACCOUNTS_BROWSER_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = fs.mkdtempSync("D:/DATN/accounts-browser-profile-");
const browserProcess = spawn(
  browser,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket,
  sequence = 0;
const pending = new Map(),
  cases = [],
  requests = [],
  exceptions = [];
let failAccounts = false,
  invitationSequence = 0;
let workspaceName = "Personal workspace";
const relationships = [
  {
    id: 100,
    property_id: 10,
    property_name: "House A",
    area_id: 20,
    area_name: "Area A",
    agreement_reference: "Fixture",
    effective_from: "2026-11-09",
    ended_at: null,
    version: 0,
  },
  {
    id: 101,
    property_id: 11,
    property_name: "House B",
    area_id: null,
    area_name: null,
    agreement_reference: "Fixture",
    effective_from: "2026-11-09",
    ended_at: null,
    version: 0,
  },
];
const directAccounts = [];
const user = {
  id: 1,
  email: "owner@test.invalid",
  fullName: "Browser Owner",
  avatarUrl: null,
  availableRoles: ["OWNER"],
  activeRole: "OWNER",
};
const properties = [
  { id: 10, name: "House A" },
  { id: 11, name: "House B" },
];
const manager = {
  id: 2,
  profile_id: null,
  full_name: "Manager Alpha",
  email: "manager@test.invalid",
  phone: "0900000002",
  role_code: "MANAGER",
  status: "ACTIVE",
  assignments: [
    {
      property_id: 10,
      property_name: "House A",
      role_code: "MANAGER",
      is_primary: false,
      area_id: 20,
      area_name: "Area A",
    },
  ],
};
const tenant = {
  id: null,
  profile_id: 3,
  full_name: "Tenant Profile",
  email: "tenant@test.invalid",
  phone: "0900000003",
  role_code: "TENANT",
  status: "NO_ACCOUNT",
  residence_status: "CHECKED_OUT",
  tenant_code: "NT03",
  room_code: "101",
  contract_code: "HD03",
  assignments: [
    { property_id: 10, property_name: "House A", role_code: "TENANT" },
  ],
};
let capabilities = [{ property_id: 10, capability: "FINANCE_READ" }],
  invitations = [],
  history = [];
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error(`CDP timeout: ${method}`));
    }, 25000);
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
  const response = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails)
    throw Error(JSON.stringify(response.exceptionDetails));
  return response.result?.value;
}
async function until(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await evaluate(expression)) return;
    } catch {}
    await sleep(100);
  }
  throw Error(
    `UI condition timed out: ${expression}; ${await evaluate("document.querySelector('dialog')?.innerText || document.body.innerText")}`,
  );
}
const js = (value) => JSON.stringify(value);
async function click(text, scope = "document") {
  await evaluate(
    `(()=>{const el=[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${js(text)}&&e.getClientRects().length);if(!el)throw Error('Button missing: '+${js(text)});el.click()})()`,
  );
}
async function fill(selector, value) {
  await evaluate(
    `(()=>{const el=document.querySelector(${js(selector)});if(!el)throw Error('Input missing');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${js(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
async function check(label) {
  await evaluate(
    `(()=>{const row=[...document.querySelectorAll('dialog label')].find(e=>e.textContent.trim()===${js(label)});if(!row)throw Error('Checkbox label missing: '+${js(label)});row.querySelector('input').click();})()`,
  );
}
function newInvitation(body) {
  const token = (++invitationSequence === 1 ? "a" : "b").repeat(43);
  for (const i of invitations)
    if (i.email === body.email && i.status === "PENDING") i.status = "REVOKED";
  const row = {
    id: invitationSequence,
    email: body.email,
    full_name: body.fullName,
    role_code: body.role,
    status: "PENDING",
    expires_at: "2026-11-11T00:00:00",
    created_at: "2026-11-09T00:00:00",
    tenant_profile_id: body.tenantProfileId,
  };
  invitations.unshift(row);
  return { id: row.id, token, delivery: "MANUAL_LINK", expiresInHours: 48 };
}
function api(request) {
  const url = new URL(request.url),
    route = url.pathname.replace(/^\/api/, ""),
    method = request.method,
    body = request.postData ? JSON.parse(request.postData) : {};
  if (method === "OPTIONS") return [204, null];
  requests.push({ route, method, body });
  if (route === "/auth/refresh")
    return [
      200,
      {
        accessToken: "browser-test-token",
        expiresIn: 900,
        tokenType: "Bearer",
      },
    ];
  if (route === "/auth/me") return [200, user];
  if (route === "/admin/account-provisioning/options")
    return [
      200,
      {
        properties,
        areas: [{ id: 20, name: "Area A" }],
        roles: ["MANAGER", "ACCOUNTANT", "TECHNICIAN", "TENANT"],
        existingAccounts: [manager],
        tenantProfiles: [],
      },
    ];
  if (route === "/admin/account-provisioning" && method === "POST") {
    directAccounts.push({
      id: 50,
      full_name: body.fullName,
      phone: body.phone,
      email: body.email,
      role_code: body.roles[0],
      status: body.initialStatus,
      must_change_password: true,
      created_at: "2026-11-10T00:00:00",
      assignments: body.propertyIds.map((id) => ({
        property_id: id,
        property_name: properties.find((p) => p.id === id).name,
        role_code: body.roles[0],
      })),
    });
    return [
      201,
      {
        id: 50,
        roles: body.roles,
        loginIdentifier: body.phone,
        initialPassword: "Synthetic-Only-123",
        linkedExisting: false,
        mustChangePassword: true,
        passwordExpiresInHours: 48,
        tenantProfileId: null,
      },
    ];
  }
  if (route === "/owner/accounts/options")
    return [
      200,
      {
        properties,
        areas: [{ id: 20, name: "Area A", organization_id: 1 }],
        staff: [manager],
        emailDeliveryAvailable: false,
        managerAssignments: manager.assignments.map((a) => ({
          ...a,
          manager_id: 2,
          full_name: manager.full_name,
        })),
      },
    ];
  if (route === "/owner/accounts" && method === "GET") {
    if (failAccounts)
      return [
        500,
        {
          message: "Browser fixture backend unavailable",
          code: "TEST_BACKEND_UNAVAILABLE",
        },
      ];
    let items = [manager, tenant, ...directAccounts];
    const role = url.searchParams.get("role");
    if (role) items = items.filter((i) => i.role_code === role);
    const keyword = url.searchParams.get("keyword");
    if (keyword)
      items = items.filter((i) =>
        i.full_name.toLowerCase().includes(keyword.toLowerCase()),
      );
    return [
      200,
      {
        summary: {
          totalAccounts: 1,
          MANAGER: 1,
          TENANT: 0,
          ACCOUNTANT: 0,
          TECHNICIAN: 0,
          locked: 0,
          pending: invitations.filter((i) => i.status === "PENDING").length,
        },
        items,
        total: items.length,
        page: 0,
        size: 20,
      },
    ];
  }
  if (route === "/owner/accounts/2" && method === "GET")
    return [
      200,
      { user: manager, assignments: manager.assignments, capabilities },
    ];
  if (route === "/owner/accounts/2/assignments" && method === "PUT") {
    manager.assignments = body.propertyIds.map((id) => ({
      property_id: id,
      property_name: properties.find((p) => p.id === id).name,
      role_code: "MANAGER",
      is_primary: body.primary,
      area_id: id === 10 ? 20 : null,
      area_name: id === 10 ? "Area A" : null,
    }));
    capabilities = body.propertyIds.flatMap((id) =>
      body.capabilities.map((capability) => ({ property_id: id, capability })),
    );
    history.unshift({
      id: history.length + 1,
      action: "STAFF_ASSIGNMENT_UPDATED",
      reason: body.reason,
      occurred_at: "2026-11-09T00:00:00",
      resource_type: "USER",
      resource_id: 2,
    });
    return [200, null];
  }
  if (route.match(/^\/owner\/accounts\/2\/assignments\/\d+\/revoke$/)) {
    const id = Number(route.split("/")[5]);
    manager.assignments = manager.assignments.filter(
      (a) => a.property_id !== id,
    );
    return [200, null];
  }
  if (route === "/owner/accounts/invitations" && method === "GET")
    return [200, invitations];
  if (route === "/owner/accounts/invitations" && method === "POST")
    return [200, newInvitation(body)];
  if (route.match(/^\/owner\/accounts\/invitations\/\d+\/resend$/)) {
    const id = Number(route.split("/")[4]),
      i = invitations.find((i) => i.id === id);
    return [
      200,
      newInvitation({
        email: i.email,
        fullName: i.full_name,
        role: i.role_code,
        tenantProfileId: i.tenant_profile_id,
      }),
    ];
  }
  if (route === "/owner/accounts/history") return [200, history];
  if (route === "/admin/settings/overview")
    return [
      200,
      {
        properties,
        permissions: {},
        configuredIntegrations: {},
        security: {},
        systemName: "SmartHome AI",
        defaultLanguage: "vi",
        timezone: "Asia/Bangkok",
        currency: "VND",
      },
    ];
  if (route === "/admin/settings/organization")
    return [200, { group: "organization", values: {}, editable: true }];
  if (route === "/owner/organizations/1" && method === "PUT") {
    workspaceName = body.name;
    return [200, null];
  }
  if (
    route.match(/^\/owner\/organizations\/1\/relationships\/\d+\/area$/) &&
    method === "PUT"
  ) {
    const id = Number(route.split("/")[5]);
    const row = relationships.find((r) => r.id === id);
    row.area_id = body.areaId;
    row.area_name = body.areaId ? "Area A" : null;
    row.version++;
    return [200, null];
  }
  if (route === "/owner/organizations")
    return [
      200,
      [
        {
          id: 1,
          code: "PERSONAL",
          name: workspaceName,
          description: "",
        },
      ],
    ];
  if (route === "/owner/organizations/1")
    return [
      200,
      {
        organization: {
          id: 1,
          code: "PERSONAL",
          name: workspaceName,
          description: "",
        },
        areas: [
          {
            id: 20,
            code: "AREA-A",
            name: "Area A",
            description: "Operational area",
            status: "ACTIVE",
            version: 0,
          },
        ],
        relationships,
        availableProperties: [],
      },
    ];
  return [
    404,
    {
      code: "FIXTURE_ROUTE_MISSING",
      message: `Fixture missing: ${method} ${route}`,
    },
  ];
}
async function intercept(event) {
  let status, data;
  try {
    [status, data] = api(event.request);
  } catch (error) {
    status = 500;
    data = { message: error.message };
  }
  const body =
    status >= 400 ? data : { success: true, message: "Fixture response", data };
  await command("Fetch.fulfillRequest", {
    requestId: event.requestId,
    responseCode: status,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: origin },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      {
        name: "Access-Control-Allow-Headers",
        value: "Authorization,Content-Type,Accept",
      },
      {
        name: "Access-Control-Allow-Methods",
        value: "GET,POST,PUT,PATCH,OPTIONS",
      },
    ],
    body: Buffer.from(status === 204 ? "" : JSON.stringify(body)).toString(
      "base64",
    ),
  });
}
(async () => {
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      const active = path.join(profile, "DevToolsActivePort");
      if (fs.existsSync(active)) {
        port = Number(fs.readFileSync(active, "utf8").split(/\r?\n/)[0]);
        break;
      }
      await sleep(100);
    }
    assert.ok(port, "Chromium did not start");
    const targets = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    socket = new WebSocket(
      targets.find((t) => t.type === "page").webSocketDebuggerUrl,
    );
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const action = pending.get(msg.id);
        pending.delete(msg.id);
        if (action) {
          if (msg.error) action.reject(Error(msg.error.message));
          else action.resolve(msg.result);
        }
      } else if (msg.method === "Fetch.requestPaused")
        void intercept(msg.params).catch((e) => {
          // React Query cancels stale requests during route transitions; Chrome retires those IDs.
          if (e.message !== "Invalid InterceptionId.")
            exceptions.push(e.message);
        });
      else if (msg.method === "Page.javascriptDialogOpening")
        void command("Page.handleJavaScriptDialog", {
          accept: true,
          promptText: "Browser verification",
        });
      else if (msg.method === "Runtime.exceptionThrown")
        exceptions.push(msg.params.exceptionDetails.text);
    });
    await command("Page.enable");
    await command("Runtime.enable");
    await command("Fetch.enable", {
      patterns: [
        { urlPattern: "*localhost:8080/api/*", requestStage: "Request" },
        { urlPattern: "*127.0.0.1:8080/api/*", requestStage: "Request" },
      ],
    });
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await command("Page.navigate", { url: `${origin}/admin/accounts` });
    await until("document.body.innerText.includes('Manager Alpha')");
    assert.ok(
      await evaluate("document.body.innerText.includes('Tài khoản & Nhân sự')"),
    );
    cases.push("Account list and tenant profile link render");
    await click("Phân công");
    await until(
      "document.querySelector('dialog')?.innerText.includes('Nạp phân công hiện tại')",
    );
    await click("House A", "document.querySelector('dialog')");
    await check("House B");
    await check("Ghi nhận nghiệp vụ tài chính");
    await check("Chỉ định phụ trách chính tại các cơ sở đã chọn");
    await fill("dialog textarea", "Browser manager assignment");
    await evaluate("document.querySelector('dialog form').requestSubmit()");
    await until("!document.querySelector('dialog')");
    const assigned = requests.find(
      (r) => r.method === "PUT" && r.route === "/owner/accounts/2/assignments",
    );
    assert.deepEqual(assigned.body.propertyIds, [10, 11]);
    assert.ok(
      assigned.body.capabilities.includes("FINANCE_READ") &&
        assigned.body.capabilities.includes("FINANCE_WRITE"),
    );
    assert.equal(assigned.body.primary, true);
    cases.push(
      "Edit existing manager rights, multi-property and primary assignment",
    );
    await click("Chi tiết");
    await until(
      "document.querySelector('dialog')?.innerText.includes('Thu hồi phân công tại cơ sở')",
    );
    await click(
      "Thu hồi phân công tại cơ sở",
      "document.querySelector('dialog')",
    );
    await until(
      "!document.querySelector('dialog')?.innerText.includes('House A')",
    );
    assert.equal(manager.assignments.length, 1);
    await evaluate(
      "document.querySelector('dialog button[aria-label=\"Đóng\"]').click()",
    );
    cases.push(
      "Revoke one property refreshes detail without deleting other assignment",
    );
    await click("+ Tạo tài khoản");
    await until("!!document.querySelector('dialog input[name=fullName]')");
    await fill("dialog input[name=fullName]", "Direct Browser Manager");
    await fill("dialog input[name=phone]", "0901234567");
    await click("Tiếp tục", "document.querySelector('dialog')");
    await until(
      "document.querySelector('dialog')?.innerText.includes('Một hoặc nhiều vai trò')",
    );
    await click("Tiếp tục", "document.querySelector('dialog')");
    await until(
      "document.querySelector('dialog')?.innerText.includes('Một hoặc nhiều nhà trọ')",
    );
    await check("House A");
    await click("Tiếp tục", "document.querySelector('dialog')");
    await until("!!document.querySelector('dialog textarea[name=reason]')");
    await fill("dialog textarea[name=reason]", "Browser direct provisioning");
    await click("Tạo tài khoản", "document.querySelector('dialog')");
    await until(
      "!!document.querySelector('dialog input[aria-label=\"Mật khẩu khởi tạo\"]')",
    );
    assert.ok(
      requests.some(
        (r) => r.route === "/admin/account-provisioning" && r.method === "POST",
      ),
    );
    await click("Đã lưu thông tin an toàn", "document.querySelector('dialog')");
    await until("document.body.innerText.includes('Direct Browser Manager')");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('dialog input[aria-label=\"Mật khẩu khởi tạo\"]').length",
      ),
      0,
    );
    cases.push(
      "Four-step direct creation accepts phone-only login, assigns scope and reveals credentials once",
    );
    await click("Quản lý tài khoản");
    await click("Thiết lập bằng liên kết (tùy chọn)");
    await click("Thêm liên kết tùy chọn");
    await until("!!document.querySelector('dialog input[name=name]')");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('dialog input[type=password]').length",
      ),
      0,
    );
    await fill("dialog input[name=name]", "Invited Manager");
    await fill("dialog input[name=email]", "invited@test.invalid");
    await fill("dialog textarea[name=reason]", "Browser invite");
    await evaluate("document.querySelector('dialog form').requestSubmit()");
    await until("!!document.querySelector('dialog input[readonly]')");
    assert.match(
      await evaluate("document.querySelector('dialog input[readonly]').value"),
      /\/accept-invitation#token=/,
    );
    await evaluate(
      "document.querySelector('dialog button[aria-label=\"Đóng\"]').click()",
    );
    cases.push(
      "Invitation returns one-time fragment link without plaintext password",
    );
    await until("document.body.innerText.includes('invited@test.invalid')");
    await click("Gửi lại");
    await until("!!document.querySelector('dialog input[readonly]')");
    assert.equal(invitationSequence, 2);
    await evaluate(
      "document.querySelector('dialog button[aria-label=\"Đóng\"]').click()",
    );
    cases.push("Resend invitation updates its state and link");
    await click("Người thuê");
    await until(
      "document.querySelector('tbody')?.innerText.includes('Tenant Profile')",
    );
    assert.ok(
      await evaluate(
        "document.querySelector('tbody').innerText.includes('Đã trả phòng')&&document.querySelector('tbody').innerText.includes('Chưa có tài khoản')",
      ),
    );
    cases.push("Tenant residence and account statuses are distinct");
    const accountsScreenshot = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    fs.writeFileSync(
      "D:/DATN/accounts-browser-accounts.png",
      Buffer.from(accountsScreenshot.data, "base64"),
    );
    await command("Page.navigate", { url: `${origin}/admin/organizations` });
    await until(
      "location.pathname==='/admin/areas'&&document.body.innerText.includes('Area A')",
    );
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('Tạo công ty / tổ chức')",
      ),
    );
    cases.push(
      "Legacy organization route redirects to areas without company creation form",
    );
    await click("Nhà trọ");
    await until(
      "document.body.innerText.includes('Nhà trọ chưa phân khu vực')",
    );
    assert.ok(await evaluate("document.body.innerText.includes('House B')"));
    cases.push("Ungrouped properties remain visible");
    await evaluate(
      "(()=>{const el=document.querySelector('select[name=property]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'11');el.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await until("!document.querySelector('input[name=reference]')");
    await evaluate(
      "(()=>{const el=document.querySelector('select[name=area]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'20');el.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await fill("form input[name=reason]", "Group existing property");
    await evaluate("document.querySelector('form').requestSubmit()");
    await until("document.body.innerText.includes('Đã gán nhà trọ')");
    assert.equal(relationships[1].area_id, 20);
    assert.equal(manager.assignments.length, 1);
    cases.push(
      "Group existing property without creating another organization or changing staff grants",
    );
    const areasScreenshot = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    fs.writeFileSync(
      "D:/DATN/accounts-browser-areas.png",
      Buffer.from(areasScreenshot.data, "base64"),
    );
    await command("Page.navigate", {
      url: `${origin}/admin/settings/organization`,
    });
    await until("!!document.querySelector('input[name=code]')");
    await fill("input[name=name]", "Updated Owner Workspace");
    await evaluate(
      "document.querySelector('input[name=code]').closest('form').requestSubmit()",
    );
    await until("document.body.innerText.includes('Đã lưu thông tin tổ chức')");
    assert.equal(workspaceName, "Updated Owner Workspace");
    cases.push("Organization information is editable in Settings");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await command("Page.navigate", { url: `${origin}/admin/accounts` });
    await until("document.body.innerText.includes('Manager Alpha')");
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+1",
      ),
    );
    cases.push("Mobile layout contains table overflow");
    failAccounts = true;
    await fill(
      "input[placeholder='Tên, email, số điện thoại...']",
      "backend-error",
    );
    await until("!!document.querySelector('[role=alert]')", 20000);
    cases.push("Backend errors are visible with retry");
    assert.deepEqual(exceptions, []);
    console.log(
      JSON.stringify({ passed: cases.length, cases, exceptions }, null, 2),
    );
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        await command("Browser.close");
      } catch {}
      socket.close();
    }
    browserProcess.kill();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
