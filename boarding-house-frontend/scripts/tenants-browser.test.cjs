/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/tenants-browser-profile-");
const browserProcess = spawn(
  process.env.MANAGEMENT_BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket,
  sequence = 0;
const pending = new Map(),
  cases = [],
  requests = [],
  exceptions = [];
let role = "OWNER",
  mode = "normal";
const properties = [
  { id: 10, name: "House A" },
  { id: 11, name: "House B" },
];

let saved;
let person = {
  id: 71,
  tenantCode: "NT000071",
  fullName: "Tenant Workspace",
  phone: "0912345678",
  email: null,
  profileStatus: "ACTIVE",
  status: "PENDING",
  hasAccount: false,
  accountStatus: null,
  propertyId: 10,
  propertyName: "House A",
  roomId: null,
  contractId: null,
  roomCode: null,
  buildingName: null,
  residenceRole: null,
  contractCode: null,
  contractEndDate: null,
  moveInDate: null,
  outstandingDebt: 0,
  financialStatus: "NO_DEBT",
  temporaryResidenceStatus: "NOT_DECLARED",
};
const detail = () => ({
  ...person,
  userId: null,
  version: 0,
  managementPropertyId: 10,
  canReadFinance: role === "OWNER",
  identityVerified: false,
  dateOfBirth: null,
  gender: null,
  avatarUrl: null,
  permanentAddress: null,
  hometown: null,
  occupation: null,
  workplace: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  identityType: null,
  maskedIdentityNumber: null,
  identityIssuedDate: null,
  identityIssuedPlace: null,
  note: null,
  residences: [],
  contracts: [],
  invoices: [],
  payments: [],
  utilityReadings: [],
  coResidents: [],
  maintenanceRequests: [],
  temporaryResidences: [],
  documents: [],
  activities: [],
  financial: {
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    overdueDebt: 0,
    depositHeld: 0,
  },
});
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, "");
  if (request.method === "OPTIONS") return [204, null];
  if (route === "/admin/tenants" && request.method === "POST") {
    saved = JSON.parse(request.postData);
    person = { ...person, fullName: saved.fullName, phone: saved.phone };
    return [201, { id: 71, tenantCode: person.tenantCode }];
  }
  if (route === "/admin/tenants") {
    requests.push({ route, params: Object.fromEntries(u.searchParams) });
    return [
      200,
      {
        properties,
        rooms: [
          {
            id: 101,
            propertyId: 10,
            code: "P101",
            capacity: 2,
            status: "VACANT",
          },
        ],
        summary: {
          total: 1,
          active: 0,
          expiringContracts: 0,
          overdueDebt: 0,
          movedOut: 0,
          temporaryRegistered: 0,
          temporaryPending: 0,
          noAccount: 1,
          customersWithDebt: 0,
          pendingCheckin: 1,
        },
        page: {
          items: [person],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
      },
    ];
  }
  if (route === "/admin/tenants/71") return [200, detail()];
  if (route === "/admin/account-provisioning/options")
    return [
      200,
      {
        properties,
        areas: [],
        roles: ["TENANT"],
        existingAccounts: [],
        tenantProfiles: [
          {
            id: 71,
            full_name: person.fullName,
            phone: person.phone,
            email: null,
            user_id: null,
            date_of_birth: null,
            property_id: 10,
            property_name: "House A",
            room_code: null,
            contract_code: null,
          },
        ],
      },
    ];
  if (route === "/admin/contracts") {
    requests.push({ route, params: Object.fromEntries(u.searchParams) });
    return [
      200,
      {
        summary: {
          total: 1,
          active: 1,
          expiring: 0,
          pendingConfirmation: 0,
          terminationRequested: 0,
          ended: 0,
        },
        properties,
        page: {
          content: [
            {
              id: 501,
              contractCode: "HD501",
              tenantId: 71,
              tenantCode: person.tenantCode,
              tenantName: person.fullName,
              tenantPhone: person.phone,
              propertyId: 10,
              propertyName: "House A",
              roomId: 101,
              roomCode: "P101",
              startDate: "2026-11-01",
              endDate: "2027-11-01",
              monthlyRent: 1000000,
              depositAmount: 1000000,
              daysRemaining: 300,
              status: "ACTIVE",
              hasDocument: false,
              paymentCycle: "MONTHLY",
              confirmationVersion: 1,
              landlordConfirmed: true,
              tenantConfirmed: false,
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
      },
    ];
  }
  return fallbackApi(request);
}
function fallbackApi(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, "");
  requests.push({ route, params: Object.fromEntries(u.searchParams) });
  if (request.method === "OPTIONS") return [204, null];
  const user = {
    id: 1,
    fullName: "Fixture User",
    email: "fixture@example.invalid",
    avatarUrl: null,
    activeRole: role,
    availableRoles: [role],
  };
  if (route === "/auth/refresh")
    return role === "ANON"
      ? [401, { message: "No session" }]
      : [200, { accessToken: "fixture-token", tokenType: "Bearer", user }];
  if (route === "/auth/me") return [200, user];
  if (route === "/technician/notifications") return [200, []];
  if (route === "/technician/dashboard" || route === "/tenant/home")
    return [
      503,
      { message: "Portal data intentionally unavailable in redirect test" },
    ];
  const props = role === "MANAGER" ? properties.slice(0, 1) : properties;
  if (route === "/admin/properties/options")
    return [
      200,
      {
        properties: props.map((p) => ({ id: p.id, label: p.name })),
        buildings: [],
        floors: [],
      },
    ];
  if (route === "/owner/organizations")
    return [200, [{ id: 1, name: "Fixture Company", code: "TEST" }]];
  if (route === "/owner/organizations/1")
    return [
      200,
      {
        organization: { id: 1, name: "Fixture Company" },
        areas: [{ id: 20, name: "Area A" }],
        relationships: [{ property_id: 10, area_id: 20, ended_at: null }],
        availableProperties: properties,
      },
    ];
  const id = Number(u.searchParams.get("propertyId"));
  const rooms = props
    .filter((p) => !id || p.id === id)
    .map((p) => ({
      id: p.id,
      propertyName: p.name,
      roomCode: p.id === 10 ? "A101" : "B201",
      floorName: "Floor 1",
      tenantName: null,
      status: "VACANT",
      outstandingDebt: 0,
      hasOpenMaintenance: false,
      contractEndDate: null,
    }));
  if (route === "/admin/dashboard") {
    if (mode === "error")
      return [503, { message: "Fixture service unavailable" }];
    return [
      200,
      {
        availableProperties: mode === "empty" ? [] : props,
        summary: {
          totalProperties: rooms.length,
          totalRooms: rooms.length,
          occupiedRooms: 0,
          vacantRooms: rooms.length,
          reservedRooms: 0,
          maintenanceRooms: 0,
          occupancyRate: 0,
          currentRevenue: 1234567,
          outstandingDebt: 222222,
          expiringContracts: 0,
          openMaintenanceRequests: 0,
        },
        roomStatusSummary: [{ status: "VACANT", count: rooms.length }],
        roomMap: rooms,
        revenueHistory: [
          {
            period: "11/2026",
            revenue: 1234567,
            expense: 100000,
            outstandingDebt: 222222,
          },
        ],
        overdueInvoices: [],
        expiringContracts: [],
        maintenanceRequests: [],
        operationalAlerts: [],
        recentActivities: [],
        aiInsights: [],
      },
    ];
  }
  if (route === "/admin/rental-lifecycle")
    return [
      200,
      {
        summary: {
          reserved: 0,
          awaitingCheckin: 0,
          staying: 0,
          checkoutRequested: 0,
          settlementPending: 0,
          cleaningOrMaintenance: 0,
        },
        properties: props,
        rooms: [],
        tenants: [],
        contracts: [],
        bookings: [],
        checkins: [],
        checkouts: [],
      },
    ];
  if (route.startsWith("/admin/reports/"))
    return [
      200,
      {
        scope: {
          propertyIds: role === "MANAGER" ? [] : props.map((p) => p.id),
        },
        availableProperties: props,
        summary: {
          periodInvoiceObligations: 3000000,
          confirmedCosts: 100000,
          totalPaidAmount: 1000000,
          totalInvoiceAmount: 3000000,
          outstandingDebt: 2000000,
        },
        details: route.endsWith("occupancy")
          ? props.map((p) => ({ property_name: p.name, occupancy_rate: 0 }))
          : route.endsWith("expenses")
            ? [{ category: "Sửa chữa", amount: 100000 }]
            : [],
        trend: [],
        breakdown: [],
        roomStatus: [],
        revenueTrend: [],
        operationalAlerts: [],
      },
    ];
  if (route === "/admin/invoices")
    return [
      200,
      { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 },
    ];
  if (route === "/admin/rooms")
    return [
      200,
      {
        summary: {
          totalRooms: rooms.length,
          occupiedRooms: 0,
          vacantRooms: rooms.length,
          reservedRooms: 0,
          maintenanceRooms: 0,
          inactiveRooms: 0,
        },
        page: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      },
    ];
  return [200, {}];
}
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
async function intercept(event) {
  if (mode === "loading" && event.request.url.includes("/admin/dashboard"))
    await sleep(2000);
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

    async function go(route) {
      await command("Page.navigate", { url: origin + route });
      await until("!!document.querySelector('main')");
    }
    async function fill(selector, value) {
      await evaluate(
        "(()=>{const el=document.querySelector(" +
          JSON.stringify(selector) +
          ');if(!el)throw Error("Missing input");Object.getOwnPropertyDescriptor(el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(el,' +
          JSON.stringify(value) +
          ');el.dispatchEvent(new Event("input",{bubbles:true}));})()',
      );
    }
    await go("/admin/tenants");
    await until("document.body.innerText.includes('Tenant Workspace')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Tổng hồ sơ')&&document.body.innerText.includes('Chưa có tài khoản')",
      ),
    );
    cases.push("Six tenant summaries and independent profile load");
    await click("Dạng thẻ");
    await until(
      "document.querySelector('main').innerText.includes('Dạng bảng')",
    );
    cases.push("Card view toggle");
    await fill("input[type=date]", "2026-11-01");
    await until("document.querySelector('main')!==null");
    await sleep(500);
    assert.ok(requests.some((r) => r.params.moveInFrom === "2026-11-01"));
    cases.push("Move-in date filter sent to backend");
    await go("/admin/tenants/71");
    await until("document.body.innerText.includes('Tiếp nhận / Lập hợp đồng')");
    assert.ok(
      await evaluate("!!document.querySelector('a[href*=tenantProfileId]')"),
    );
    cases.push("Independent profile can continue to direct contract");
    await click("Tạo ngay");
    await until("!!document.querySelector('dialog[open] input')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('dialog[open] input')].some(e=>e.value==='Tenant Workspace')",
      ),
    );
    cases.push(
      "Tenant profile opens direct provisioning wizard with its existing identity",
    );
    await go("/admin/tenants/71");
    await until("document.body.innerText.includes('Tiền cọc')");
    await click("Tiền cọc");
    await until(
      "document.body.innerText.includes('Chưa có hợp đồng để theo dõi sổ cọc')",
    );
    cases.push(
      "Deposit tab does not invent a balance or ledger for contractless profiles",
    );
    await go("/admin/tenants/intake");
    await until("document.body.innerText.includes('Tenant Workspace')");
    await click("Tenant WorkspaceNT000071 · 0912345678").catch(async () => {
      await evaluate(
        "[...document.querySelectorAll('main button')].find(b=>b.innerText.includes('Tenant Workspace')).click()",
      );
    });
    await click("Tiếp theo");
    await until("document.body.innerText.includes('Khả năng tiếp nhận')");
    cases.push(
      "Intake wizard selects existing profile and retains it across steps",
    );
    await go("/admin/tenants/new");
    await until("!!document.querySelector('input[name=fullName]')");
    await fill("input[name=fullName]", "New Independent Tenant");
    await fill("input[name=phone]", "0912345689");
    await click("Tiếp tục");
    await until("!!document.querySelector('input[name=identityNumber]')");
    await click("Tiếp tục");
    await until("document.body.innerText.includes('Lưu hồ sơ')");
    await click("Lưu hồ sơ");
    await until(
      "document.body.innerText.includes('New Independent Tenant')&&location.pathname==='/admin/tenants/71'",
    );
    assert.ok(saved);
    assert.equal(saved.roomId, undefined);
    assert.equal(saved.moveInDate, undefined);
    assert.equal(saved.identityNumber, undefined);
    cases.push(
      "Create independent profile without identity, room, move-in, account or contract request",
    );
    await command("Page.reload");
    await until("document.body.innerText.includes('New Independent Tenant')");
    cases.push("Reload renders profile returned by API");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await go("/admin/tenants");
    await until("document.body.innerText.includes('New Independent Tenant')");
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+1",
      ),
    );
    cases.push("Mobile tenant list has no page overflow");
    role = "MANAGER";
    await go("/admin/tenants/71");
    await until("document.body.innerText.includes('New Independent Tenant')");
    assert.ok(
      await evaluate(
        "![...document.querySelectorAll('main nav button')].some(e=>e.textContent.trim()==='Tiền cọc')",
      ),
    );
    cases.push(
      "Manager without finance capability does not see financial tabs",
    );
    role = "OWNER";
    await go("/admin/contracts");
    await until("document.body.innerText.includes('HD501')");
    await evaluate(
      "(()=>{const s=document.querySelector('select[aria-label=\"Lọc phòng hợp đồng\"]');s.value='101';s.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await fill('input[aria-label="Ngày bắt đầu hợp đồng từ"]', "2026-11-01");
    await fill('input[aria-label="Ngày kết thúc hợp đồng đến"]', "2027-11-01");
    await sleep(400);
    assert.ok(
      requests.some(
        (r) =>
          r.route === "/admin/contracts" &&
          r.params.roomId === "101" &&
          r.params.startDateFrom === "2026-11-01" &&
          r.params.endDateTo === "2027-11-01",
      ),
    );
    cases.push("Contract room and date filters send backend query parameters");
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
  console.error(JSON.stringify({ cases, exceptions }));
  process.exitCode = 1;
});
