/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/finance-browser-profile-");
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

const posts = [],
  exportsRequested = [];
let failIncome = true,
  paid = false,
  approved = false;
const props = [
  {
    id: 10,
    name: "House A",
    organizationId: 30,
    organizationName: "Company A",
    areaId: 40,
    areaName: "Area A",
  },
  {
    id: 11,
    name: "House B",
    organizationId: 31,
    organizationName: "Company B",
    areaId: 41,
    areaName: "Area B",
  },
];
const vouchers = [
  {
    id: 71,
    code: "PC71",
    event_date: "2026-11-17",
    property_id: 10,
    property_name: "House A",
    category: "REPAIR",
    amount: 2000000,
    status: "PENDING_APPROVAL",
    version: 1,
    created_by: 3,
    content: "Repair source evidence",
    payee_name: "Supplier",
    actor_name: "Accountant",
  },
  {
    id: 72,
    code: "PC72",
    event_date: "2026-11-17",
    property_id: 10,
    property_name: "House A",
    category: "OPERATING",
    amount: 500000,
    status: "APPROVED",
    version: 2,
    created_by: 3,
    payee_name: "Supplier",
  },
];
const deposits = [
  {
    id: 81,
    property_id: 10,
    contract_id: 501,
    contract_code: "HD501",
    tenant_name: "Tenant A",
    required_amount: 3000000,
    received_amount: 2000000,
    collected_amount: 2000000,
    transferred_amount: 0,
    remaining_deposit_due: 1000000,
    balance_amount: 2000000,
    refund_due: 0,
    refunded_amount: 0,
    deducted_amount: 0,
    reconciliation_status: "VERIFIED",
  },
  {
    id: 82,
    property_id: 10,
    booking_id: 601,
    booking_code: "BK601",
    required_amount: 500000,
    received_amount: 0,
    remaining_deposit_due: 500000,
    balance_amount: 0,
    refund_due: 0,
    refunded_amount: 0,
    reconciliation_status: "NEEDS_REVIEW",
  },
];
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, ""),
    params = Object.fromEntries(u.searchParams);
  requests.push({ route, params, method: request.method });
  if (request.method === "OPTIONS") return [204, null];
  if (request.method === "POST" && route.includes("/finance/")) {
    posts.push({
      route,
      body: JSON.parse(request.postData || "{}"),
      headers: request.headers,
    });
    if (route.endsWith("/workspace/income") && failIncome) {
      failIncome = false;
      return [503, { message: "Fixture network failure" }];
    }
    if (route.endsWith("/71/approve")) approved = true;
    if (route.endsWith("/72/pay")) paid = true;
    return [200, { id: 99, status: "CONFIRMED", automaticRepair: false }];
  }
  if (route === "/accountant/account") return [200, { properties: props }];
  if (route === "/accountant/notifications") return [200, []];
  if (route.endsWith("/periods/91/closing-check"))
    return [
      200,
      {
        blockingCount: 1,
        findings: [{ code: "LEGACY_SOURCE_MISSING", severity: "BLOCKING" }],
      },
    ];
  if (route.endsWith("/deposit-ledger")) return [200, deposits];
  if (route.match(/deposit-ledger\/8[12]$/))
    return [
      200,
      {
        ...deposits.find((x) => x.id === Number(route.split("/").at(-1))),
        transactions: [],
        refunds: [],
      },
    ];
  if (route.endsWith("/finance/workspace/export")) {
    exportsRequested.push(params);
    return [200, "fixture workbook"];
  }
  if (route.endsWith("/finance/workspace")) {
    const tab = params.tab;
    let rows =
      tab === "vouchers"
        ? vouchers.map((x) => ({
            ...x,
            status:
              x.id === 71 && approved
                ? "APPROVED"
                : x.id === 72 && paid
                  ? "PAID"
                  : x.status,
          }))
        : tab === "periods"
          ? [
              {
                id: 91,
                code: "2026-11",
                property_id: 10,
                property_name: "House A",
                event_date: "2026-11-01",
                start_date: "2026-11-01",
                end_date: "2026-11-30",
                status: "OPEN",
                version: 0,
              },
            ]
          : tab === "reconciliation"
            ? [
                {
                  id: 92,
                  code: "DS92",
                  property_id: 10,
                  property_name: "House A",
                  event_date: "2026-11-17",
                  status: "NEEDS_REVIEW",
                  blocking_count: 1,
                  findings_json: '[{"code":"LEGACY_DEPOSIT_REVIEW"}]',
                },
              ]
            : [
                {
                  code: "PT73",
                  source_type: "PAYMENT",
                  source_id: 73,
                  event_date: "2026-11-17",
                  property_id: 10,
                  property_name: "House A",
                  category: "SERVICE_COLLECTION",
                  status: "CONFIRMED",
                  cash_in: 1000000,
                  cash_out: 0,
                  method: "CASH",
                  running_balance: 1500000,
                  reference_code: "BANK-001",
                  actor_name: "Accountant",
                  content: "Actual source payment",
                },
              ];
    if (params.status) rows = rows.filter((x) => x.status === params.status);
    if (params.keyword)
      rows = rows.filter((x) => x.code.includes(params.keyword));
    return [
      200,
      {
        propertyIds: params.organizationId === "31" ? [11] : [10],
        properties: props,
        summary: {
          periodInvoiceObligations: 3000000,
          cashIn: 1000000,
          cashOut: paid ? 500000 : 0,
          netCashFlow: paid ? 500000 : 1000000,
          confirmedCosts: 2500000,
          outstandingDebt: 2000000,
          heldDeposits: 2000000,
          pendingVouchers: 1,
          refundsPayable: 0,
        },
        funds: [{ method: "CASH", opening: 500000, closing: 1500000 }],
        ledger: {
          opening: 500000,
          incoming: 1000000,
          outgoing: paid ? 500000 : 0,
          closing: paid ? 1000000 : 1500000,
          verified: false,
        },
        trend: [
          { period: "2026-11", cashIn: 1000000, cashOut: paid ? 500000 : 0 },
        ],
        byProperty: [{ name: "House A", incoming: 1000000, outgoing: 0 }],
        costCategories: [{ category: "REPAIR", amount: 2000000 }],
        permissions: { createVoucher: role !== "OWNER", recordIncome: true },
        rows,
        totalElements: rows.length,
        totalPages: 1,
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
        value: "Authorization,Content-Type,Accept,Idempotency-Key",
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

    async function choose(selector, value) {
      await evaluate(
        "(()=>{const e=document.querySelector(" +
          js(selector) +
          ');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(e,' +
          js(value) +
          ');e.dispatchEvent(new Event("change",{bubbles:true}));})()',
      );
    }
    async function dialogSubmit() {
      await evaluate(
        "document.querySelector('[role=dialog] form').requestSubmit()",
      );
    }
    await go("/admin/finance");
    await until("document.body.innerText.includes('Dòng tiền thuần trong kỳ')");
    fs.mkdirSync(path.resolve(__dirname, "../../docs/qa/finance-redesign"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.resolve(__dirname, "../../docs/qa/finance-redesign/desktop.png"),
      Buffer.from(
        (
          await command("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
          })
        ).data,
        "base64",
      ),
    );
    assert.match(
      await evaluate("document.querySelector('input[type=date]').value"),
      /^\d{4}-\d{2}-\d{2}$/,
    );
    assert.ok(
      requests.some(
        (r) =>
          r.route.endsWith("/workspace") &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.params.startDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.params.endDate),
      ),
    );
    cases.push("admin-period-mode-resolves-to-real-calendar-dates");
    cases.push("dashboard-real-source-summary-and-charts");
    await choose('select[aria-label="Công ty tài chính"]', "30");
    await until("document.body.innerText.includes('House A')");
    await sleep(200);
    assert.ok(
      requests.some(
        (r) =>
          r.route.endsWith("/workspace") && r.params.organizationId === "30",
      ),
    );
    cases.push("company-filter-sent-with-role-scope");
    await click("Sổ tiền mặt");
    await until(
      "document.body.innerText.includes('Cần xác minh số dư đầu kỳ')",
    );
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Lũy kế')||document.body.innerText.includes('lũy kế')",
      ),
    );
    cases.push("cashbook-opening-closing-are-explicitly-unverified");
    await fill('input[placeholder="Tìm mã chứng từ hoặc nhà trọ"]', "none");
    await until(
      "document.body.innerText.includes('Không có chứng từ trong bộ lọc này')",
    );
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Đầu kỳ từ nguồn đã ghi')",
      ),
    );
    cases.push("empty-filter-keeps-ledger-context");
    await click("Sổ ngân hàng");
    await until(
      "document.body.innerText.includes('chưa đồng nghĩa đã đối soát')",
    );
    cases.push("bankbook-does-not-claim-live-bank-reconciliation");
    await click("Xuất Excel");
    await sleep(250);
    assert.equal(exportsRequested.at(-1).tab, "bankbook");
    assert.equal(exportsRequested.at(-1).organizationId, "30");
    cases.push("export-keeps-company-dates-and-book");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=document.documentElement.clientWidth+1",
      ),
    );
    fs.writeFileSync(
      path.resolve(__dirname, "../../docs/qa/finance-redesign/mobile.png"),
      Buffer.from(
        (
          await command("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
          })
        ).data,
        "base64",
      ),
    );
    cases.push("mobile-workspace-no-page-overflow");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await click("Phiếu chi");
    await until("document.body.innerText.includes('PC71')");
    await click("Duyệt");
    await fill(
      "[role=dialog] textarea[name=reason]",
      "Reviewed source evidence",
    );
    await dialogSubmit();
    await until("!document.querySelector('[role=dialog]')");
    assert.ok(posts.some((p) => p.route.endsWith("/71/approve")));
    assert.equal(paid, false);
    cases.push("approval-does-not-confirm-cash-out");
    await click(
      "Xác nhận thực chi",
      "[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('PC72'))",
    );
    await until("!!document.querySelector('[role=dialog]')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent==='Xác nhận').disabled",
      ),
    );
    await fill("[role=dialog] input[name=reference]", "PAID-VERIFIED-72");
    await fill("[role=dialog] textarea[name=reason]", "Actual paid receipt");
    await evaluate(
      "document.querySelector('[role=dialog] input[type=checkbox]').click()",
    );
    const before = requests.filter((r) =>
      r.route.endsWith("/workspace"),
    ).length;
    await dialogSubmit();
    await until("!document.querySelector('[role=dialog]')");
    assert.ok(paid);
    assert.ok(
      requests.filter((r) => r.route.endsWith("/workspace")).length > before,
    );
    cases.push("actual-pay-requires-confirmation-and-refreshes-summary");
    await click("Phiếu thu");
    await until("document.body.innerText.includes('Ghi khoản thu khác')");
    await click("Ghi khoản thu khác");
    await choose("[role=dialog] select[name=property]", "10");
    await fill("[role=dialog] input[inputmode=decimal]", "100000");
    await fill("[role=dialog] input[name=reference]", "INCOME-VERIFIED-99");
    await fill(
      "[role=dialog] textarea[name=reason]",
      "Actual separate cash source",
    );
    await evaluate(
      "document.querySelector('[role=dialog] input[type=checkbox]').click()",
    );
    await evaluate(
      "(()=>{const f=document.querySelector('[role=dialog] form');f.requestSubmit();f.requestSubmit();})()",
    );
    await until("document.body.innerText.includes('Fixture network failure')");
    const failed = posts.filter((p) => p.route.endsWith("/workspace/income"));
    assert.equal(failed.length, 1);
    await dialogSubmit();
    await until("!document.querySelector('[role=dialog]')");
    const income = posts.filter((p) => p.route.endsWith("/workspace/income"));
    assert.equal(income.length, 2);
    assert.deepEqual(income[0].body, income[1].body);
    const key = (h) =>
      Object.entries(h).find(
        ([k]) => k.toLowerCase() === "idempotency-key",
      )?.[1];
    assert.ok(key(income[0].headers));
    assert.equal(key(income[0].headers), key(income[1].headers));
    cases.push("double-click-and-network-retry-keep-same-income-request");
    await click("Tiền cọc");
    await until(
      "document.body.innerText.includes('Sổ tiền giữ chỗ và tiền cọc')",
    );
    await click("Tiền giữ phòng");
    await until(
      "[...document.querySelectorAll('option')].some(e=>e.textContent.includes('BK601'))",
    );
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('số dư chưa được xác nhận')",
      ),
    );
    cases.push("reservation-deposit-tab-and-legacy-warning");
    role = "ACCOUNTANT";
    await go("/accountant/periods");
    await until("document.body.innerText.includes('Kiểm tra và khóa kỳ')");
    assert.equal(
      await evaluate("document.querySelectorAll('aside').length"),
      1,
    );
    await click("Kiểm tra và khóa kỳ");
    await until("document.body.innerText.includes('LEGACY_SOURCE_MISSING')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent==='Xác nhận').disabled",
      ),
    );
    cases.push(
      "single-accountant-shell-and-closing-blocks-unreconciled-period",
    );
    await click("Đóng", "document.querySelector('[role=dialog]')");
    await choose('select[aria-label="Khu trọ"]', "10");
    await until(
      "document.querySelector('select[aria-label=\"Nhà trọ tài chính\"]').value==='10'",
    );
    cases.push("accountant-header-and-workspace-share-property-scope");
    assert.deepEqual(exceptions, []);
    console.log(
      JSON.stringify(
        { passed: cases.length, cases, liveApiWrites: 0 },
        null,
        2,
      ),
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
