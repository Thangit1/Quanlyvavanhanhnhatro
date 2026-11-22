/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/invoices-browser-profile-");
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

const row = {
  id: 71,
  invoiceCode: "INV-71",
  billingPeriod: "2026-11",
  property: { id: 10, name: "House A" },
  room: { id: 101, name: "A101" },
  tenant: { id: 5, name: "Nguyễn An" },
  contract: { id: 501, name: "HD501" },
  dueDate: "2026-11-05",
  issueDate: "2026-10-28",
  totalAmount: 1000,
  paidAmount: 0,
  remainingAmount: 1000,
  overdueDays: 12,
  status: "OVERDUE",
  automated: false,
  hasAdjustment: false,
  version: 0,
  createdAt: "2026-10-28T09:00:00",
  breakdown: {
    rent: 1000,
    electricity: 0,
    water: 0,
    services: 0,
    other: 0,
    discount: 0,
  },
};
const summary = {
  totalInvoiceAmount: 1000,
  totalPaidAmount: 0,
  totalOutstandingAmount: 1000,
  collectionRate: 0,
  draftInvoiceCount: 0,
  unpaidInvoiceCount: 1,
  partiallyPaidInvoiceCount: 0,
  paidInvoiceCount: 0,
  overdueInvoiceCount: 1,
  totalInvoiceCount: 1,
  issuedInvoiceCount: 1,
  overdueOutstandingAmount: 1000,
  debtTenantCount: 1,
};
const batchPosts = [],
  paymentPosts = [];
const detail = {
  ...row,
  periodStartDate: "2026-11-01",
  periodEndDate: "2026-11-30",
  paymentAvailableFrom: "2026-10-28",
  items: [
    {
      id: 1,
      itemType: "ROOM_RENT",
      name: "Tiền phòng",
      quantity: 1,
      unit: "tháng",
      unitPrice: 1000,
      amount: 1000,
    },
  ],
  subtotalAmount: 1000,
  discountAmount: 0,
  previousDebtAmount: 0,
  lateFeeAmount: 0,
  payments: [],
  adjustments: [],
  notifications: [],
  history: [],
  permissions: {
    canEdit: false,
    canIssue: false,
    canRecordPayment: true,
    canSendReminder: true,
    canAdjust: true,
    canCancel: true,
    canDownload: true,
    canPrint: true,
  },
};
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, "");
  requests.push({
    route,
    params: Object.fromEntries(u.searchParams),
    method: request.method,
  });
  if (request.method === "OPTIONS") return [204, null];
  if (route === "/admin/invoices/71/payments") {
    paymentPosts.push({
      body: JSON.parse(request.postData),
      headers: request.headers,
    });
    return paymentPosts.length === 1
      ? [503, { message: "Fixture network failure" }]
      : [200, detail];
  }
  if (route === "/admin/invoices/71") return [200, detail];
  if (route === "/admin/invoices/summary") return [200, summary];
  if (route === "/admin/invoices/options")
    return [
      200,
      {
        properties: [{ id: 10, label: "House A" }],
        buildings: [],
        floors: [],
        rooms: [{ id: 101, label: "A101", propertyId: 10 }],
        contracts: [{ id: 501, label: "HD501", parentId: 101 }],
      },
    ];
  if (route === "/admin/invoices/payment-policy")
    return [
      200,
      {
        openingDay: 28,
        monthOffset: -1,
        version: 0,
        canConfigure: true,
        openingDate: "2026-10-28",
        timezone: "Asia/Ho_Chi_Minh",
      },
    ];
  if (route === "/admin/invoices/bulk-preview")
    return [
      200,
      [
        {
          roomId: 101,
          roomCode: "A101",
          tenantName: "Nguyễn An",
          estimatedAmount: 1000,
          status: "READY",
          contractId: 501,
          contractCode: "HD501",
          calculationHash: "reviewed-hash",
          items: [
            {
              name: "Tiền phòng",
              quantity: 1,
              unit: "tháng",
              price: 1000,
              amount: 1000,
            },
          ],
        },
      ],
    ];
  if (route === "/admin/invoices/bulk-generate") {
    batchPosts.push(JSON.parse(request.postData));
    return [
      200,
      {
        created: [{ id: 72, invoiceCode: "INV72", status: "DRAFT" }],
        skipped: [
          {
            roomId: 102,
            roomCode: "A102",
            contractCode: "HD502",
            warning: "Thiếu chỉ số nước",
            status: "FAILED",
          },
        ],
      },
    ];
  }
  if (route === "/admin/invoices")
    return [
      200,
      { content: [row], page: 0, size: 20, totalElements: 1, totalPages: 1 },
    ];
  if (route === "/admin/invoices/export") return [200, "fixture export"];
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
    await go("/admin/invoices?propertyId=10&billingPeriod=2026-11");
    await until("document.body.innerText.includes('INV-71')");
    await until("document.body.innerText.includes('Nguyễn An')");
    cases.push("real-invoice-row-and-summary");
    await click("Xuất Excel");
    await sleep(350);
    assert.ok(
      requests.some(
        (r) =>
          r.route === "/admin/invoices/export" &&
          r.params.format === "xlsx" &&
          r.params.billingPeriod === "2026-11" &&
          r.params.propertyId === "10",
      ),
    );
    cases.push("export-preserves-period-property-and-format");
    await go("/admin/invoices/debt?propertyId=10");
    await until("document.body.innerText.includes('INV-71')");
    assert.ok(
      requests.some(
        (r) =>
          r.route === "/admin/invoices" &&
          r.params.status === "OUTSTANDING" &&
          r.params.sort === "debt",
      ),
    );
    cases.push("debt-query-excludes-drafts-paid-cancelled");
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
    cases.push("mobile-no-page-overflow");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await go("/admin/invoices/generate");
    await until(
      "[...document.querySelectorAll('select option')].some(x=>x.textContent==='House A')",
    );
    await evaluate(
      "(()=>{let e=document.querySelector('main select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'10');e.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await click("Kiểm tra và xem trước");
    await until("document.body.innerText.includes('HD501')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Tạo 1 hóa đơn nháp')).disabled",
      ),
    );
    cases.push("batch-review-required-and-real-charge-preview");
    await evaluate(
      "[...document.querySelectorAll('input[type=checkbox]')].at(-1).click()",
    );
    await click("Tạo 1 hóa đơn nháp");
    await until("document.body.innerText.includes('Kết quả theo hợp đồng')");
    assert.equal(batchPosts.length, 1);
    assert.equal(batchPosts[0].action, "SAVE_DRAFT");
    assert.equal(batchPosts[0].expectedHashes["501"], "reviewed-hash");
    assert.ok(
      await evaluate("document.body.innerText.includes('Thiếu chỉ số nước')"),
    );
    cases.push("batch-snapshot-selection-draft-and-per-contract-failure");

    await go("/admin/invoices/71");
    await until("document.body.innerText.includes('Ghi nhận thanh toán')");
    await click("Ghi nhận thanh toán");
    await until("document.body.innerText.includes('Tôi đã nhận và đối chiếu')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Xác nhận').disabled",
      ),
    );
    await evaluate("document.querySelector('input[type=checkbox]').click()");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Xác nhận').disabled",
      ),
    );
    await evaluate(
      "(()=>{const e=[...document.querySelectorAll('label')].find(x=>x.textContent.includes('Mã giao dịch / chứng từ')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'BANK-VERIFIED-001');e.dispatchEvent(new Event('input',{bubbles:true}));})()",
    );
    await click("Xác nhận");
    await until("document.body.innerText.includes('Fixture network failure')");
    await click("Xác nhận");
    await until(
      "!document.body.innerText.includes('Tôi đã nhận và đối chiếu')",
    );
    assert.equal(paymentPosts.length, 2);
    assert.equal(paymentPosts[0].body.amount, 1000);
    assert.deepEqual(paymentPosts[0].body, paymentPosts[1].body);
    const key = (h) =>
      Object.entries(h).find(
        ([k]) => k.toLowerCase() === "idempotency-key",
      )?.[1];
    assert.ok(key(paymentPosts[0].headers));
    assert.equal(key(paymentPosts[0].headers), key(paymentPosts[1].headers));
    cases.push(
      "actual-receipt-and-bank-reference-required",
      "failed-request-retries-same-full-amount-and-idempotency-key",
    );
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
