/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/operations-browser-profile-");
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
  jobs = [];
const reportProps = [
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
let assetRows = [
  {
    id: 81,
    code: "ASSET-A",
    name: "Fan fixture",
    property_id: 10,
    property_name: "House A",
    room_id: 101,
    room_code: "A101",
    category: "OTHER",
    quantity: 2,
    status: "IN_USE",
    condition_status: "GOOD",
    version: 1,
    purchase_price: 200000,
    custodian: "Technician fixture",
  },
];
function operationApi(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, ""),
    params = Object.fromEntries(u.searchParams);
  requests.push({ route, params, method: request.method });
  if (request.method === "OPTIONS") return [204, null];
  if (route === "/admin/operations/options")
    return [
      200,
      {
        properties: reportProps,
        rooms: [
          { id: 101, code: "A101", propertyId: 10 },
          { id: 102, code: "B201", propertyId: 11 },
        ],
        staff: [{ id: 6, name: "Technician fixture", propertyId: 10 }],
        canWrite: true,
        canApprove: role === "OWNER",
      },
    ];
  if (route === "/admin/operations/assets" && request.method === "POST") {
    const body = JSON.parse(request.postData);
    posts.push({ route, body });
    if (mode === "save-error")
      return [409, { message: "Fixture save conflict" }];
    assetRows.push({
      id: 82,
      code: body.code,
      name: body.name,
      room_id: body.roomId,
      room_code: "A101",
      property_id: 10,
      property_name: "House A",
      category: body.category,
      quantity: body.quantity,
      status: body.status,
      condition_status: body.condition,
      version: 1,
    });
    return [200, 82];
  }
  if (route.match(/operations\/assets\/\d+$/) && request.method === "PUT") {
    posts.push({ route, body: JSON.parse(request.postData) });
    return [200, 81];
  }
  if (route.endsWith("/assets/81/history"))
    return [
      200,
      {
        changes: [
          {
            id: 1,
            new_condition: "GOOD",
            new_status: "IN_USE",
            reason: "Physical inventory",
            actor_name: "Owner fixture",
            created_at: "2026-11-18T10:00:00",
          },
        ],
        handovers: [
          {
            checkin_id: 44,
            contract_id: 501,
            contract_code: "HD501",
            asset_name: "Fan fixture",
            quantity: 2,
            condition_status: "GOOD",
          },
        ],
      },
    ];
  if (
    route.match(/operations\/(costs|material-requests)\/\d+\/review$/) ||
    route.match(/operations\/materials\/\d+\/receive$/)
  ) {
    posts.push({ route, body: JSON.parse(request.postData) });
    return [200, null];
  }
  if (route === "/admin/operations") {
    if (mode === "error")
      return [503, { message: "Fixture operations unavailable" }];
    const tab = params.tab || "assets";
    let rows =
      tab === "assets"
        ? assetRows.map((r) => ({
            ...r,
            purchase_price: role === "MANAGER" ? null : r.purchase_price,
          }))
        : tab === "materials"
          ? [
              {
                id: 91,
                code: "PART-A",
                name: "Part fixture",
                property_id: 10,
                property_name: "House A",
                quantity: 5,
                unit: "piece",
                unit_price: 100,
                status: "ACTIVE",
              },
            ]
          : tab === "approvals"
            ? [
                {
                  id: 92,
                  code: "TASK-A",
                  name: "Repair fixture",
                  property_id: 10,
                  property_name: "House A",
                  task_id: 71,
                  status: "PENDING",
                  version: 0,
                  items: "Part fixture × 3",
                  requester: "Technician fixture",
                },
              ]
            : tab === "costs"
              ? [
                  {
                    id: 93,
                    code: "TASK-A",
                    name: "Repair fixture",
                    property_id: 10,
                    property_name: "House A",
                    task_id: 71,
                    status: "PENDING",
                    version: 4,
                    estimated_cost: 1000,
                    actual_cost: 300,
                    amount: 1000,
                    paid_amount: 0,
                  },
                ]
              : [];
    if (params.propertyId === "11")
      rows =
        tab === "assets"
          ? [
              {
                ...assetRows[0],
                code: "ASSET-B",
                property_id: 11,
                property_name: "House B",
              },
            ]
          : [];
    if (params.keyword === "not-found" || mode === "empty") rows = [];
    return [
      200,
      {
        rows,
        summary: rows.length
          ? [{ status: rows[0].status, count: rows.length }]
          : [],
        totalElements: rows.length,
        totalPages: rows.length ? 1 : 0,
        page: 0,
        canWrite: true,
        canApprove: role === "OWNER",
      },
    ];
  }
  if (route === "/owner/accounts/options")
    return [
      200,
      {
        properties,
        areas: [],
        organizations: [{ id: 30, name: "Company A" }],
        staff: [],
        managerAssignments: [],
        emailDeliveryAvailable: false,
      },
    ];
  if (route === "/owner/accounts")
    return [
      200,
      {
        items: [
          {
            id: 6,
            profile_id: null,
            full_name: "Technician fixture",
            phone: "0912345678",
            email: null,
            role_code: "TECHNICIAN",
            status: "ACTIVE",
            created_at: "2026-11-18",
            assignments: [
              {
                property_id: 10,
                property_name: "House A",
                role_code: "TECHNICIAN",
                organization_name: "Company A",
              },
            ],
          },
        ],
        total: 1,
        page: 0,
        size: 20,
        summary: { totalStaff: 1, totalAccounts: 1, TECHNICIAN: 1, active: 1 },
      },
    ];
  if (route === "/admin/settings/overview")
    return [
      200,
      {
        systemName: "Fixture operations",
        logoUrl: null,
        defaultLanguage: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        currency: "VND",
        configuredIntegrations: { email: false, payment: false, ai: false },
        security: { passwordPolicyConfigured: true },
        lastUpdatedAt: null,
        lastUpdatedBy: null,
        permissions: {
          canEditGeneral: true,
          canEditBilling: true,
          canEditSecurity: true,
          canManageIntegrations: true,
          canManageBackup: false,
          canViewAuditLogs: true,
          canEditProperty: true,
        },
        properties,
      },
    ];
  if (route === "/admin/settings/ai")
    return [
      200,
      {
        provider: "none",
        model: null,
        enabled: false,
        configured: false,
        connectionStatus: "NOT_CONFIGURED",
        features: {
          tenantChatbot: false,
          invoiceExplanation: false,
          contractExplanation: false,
          maintenanceClassification: false,
          utilityAnomalyDetection: false,
        },
        monthlyRequestLimit: 0,
        responseLanguage: "vi",
        requestTimeoutSeconds: 30,
        storeConversationHistory: false,
        historyRetentionDays: 0,
        requireActionConfirmation: true,
      },
    ];
  if (route === "/admin/settings/ai/test-connection")
    return [
      200,
      { connected: false, message: "Chưa kiểm tra phản hồi mô hình thực tế." },
    ];
  return api(request);
}
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, ""),
    params = Object.fromEntries(u.searchParams);
  requests.push({ route, params, method: request.method });
  if (request.method === "OPTIONS") return [204, null];
  if (route === "/accountant/account")
    return [200, { properties: reportProps }];
  if (route === "/accountant/notifications") return [200, []];
  if (route.endsWith("/reports/workspace/options"))
    return [200, role === "MANAGER" ? reportProps.slice(0, 1) : reportProps];
  if (route.endsWith("/reports/workspace/choices"))
    return [
      200,
      {
        rooms: [{ id: 101, code: "A101" }],
        contracts: [{ id: 501, code: "HD501", roomId: 101 }],
      },
    ];
  if (route.endsWith("/reports/workspace/exports")) {
    posts.push(params);
    const job = {
      id: 900 + jobs.length,
      reportType: params.type.toUpperCase(),
      format: params.format,
      status: "COMPLETED",
      fileName: "report." + params.format.toLowerCase(),
      createdAt: "2026-11-17T10:00:00",
      fileSize: 100,
    };
    jobs.push(job);
    return [200, job];
  }
  if (route === "/admin/reports/exports") return [200, jobs];
  if (route.match(/reports\/exports\/\d+\/download$/))
    return [200, "fixture workbook"];
  if (route.endsWith("/reports/workspace")) {
    if (mode === "error")
      return [503, { message: "Fixture report unavailable" }];
    const type = params.type || "overview",
      id = Number(params.propertyId) || 10,
      restricted = role === "MANAGER";
    let row = {
      property_id: id,
      property_name: id === 10 ? "House A" : "House B",
      code: id === 10 ? "INV-A" : "INV-B",
      invoice_id: id === 10 ? 71 : 72,
      room_id: 101,
      contract_id: 501,
      tenant_name: "Tenant fixture",
      event_date: "2026-11-01",
      status: "ISSUED",
      category: "INVOICE",
      amount: restricted ? null : 3000000,
      paid_amount: 200000,
      remaining_amount: 2800000,
      due_date: "2026-11-05",
      overdue_days: 12,
      total_rooms: 2,
      occupied_rooms: 1,
      occupancy_rate: 50,
      cash_in: restricted ? null : 200000,
      cash_out: restricted ? null : 0,
      invoice_obligations: restricted ? null : 3000000,
      outstanding_debt: restricted ? null : 2800000,
      confirmed_costs: restricted ? null : 0,
    };
    if (type === "services")
      row = {
        ...row,
        code: "Internet",
        category: "SERVICE",
        unit: "tháng",
        quantity: 1,
        contract_count: 1,
        collected_amount: null,
        amount: 100000,
      };
    if (type === "assets")
      row = { ...row, code: "Fan", quantity: 2, depreciated_value: null };
    let rows = params.keyword ? [] : [row];
    return [
      200,
      {
        type,
        propertyIds: [id],
        financialPropertyIds: restricted ? [] : [id],
        startDate: params.startDate,
        endDate: params.endDate,
        updatedAt: "2026-11-17T10:00:00",
        properties: restricted ? reportProps.slice(0, 1) : reportProps,
        summary: {
          totalProperties: 1,
          totalRooms: 2,
          occupiedRooms: 1,
          vacantRooms: 1,
          maintenanceRooms: 0,
          occupancyRate: 50,
          activePeople: 1,
          expiringContracts: 1,
          ...(restricted
            ? {}
            : {
                periodInvoiceObligations: 3000000,
                cashIn: 200000,
                confirmedCosts: 0,
                netCashFlow: 200000,
                outstandingDebt: 2800000,
                heldDeposits: 1000000,
              }),
        },
        definitions: {
          occupancyRate:
            "Phòng đang thuê / phòng đủ điều kiện; không tính giữ chỗ là đã thuê.",
          roomDays: "Không suy diễn lịch sử từ trạng thái hiện tại.",
          cash: "Tiền thực nhận khác nghĩa vụ, không phải lợi nhuận pháp định.",
        },
        rows,
        totalElements: rows.length,
        totalPages: rows.length ? 1 : 0,
        filteredTotals: {
          amount: rows.length && !restricted ? Number(row.amount) : null,
          rowCount: rows.length,
        },
        trend: restricted
          ? []
          : [
              {
                period: "2026-11",
                obligations: 3000000,
                cashIn: 200000,
                cashOut: 0,
              },
            ],
        roomStatuses: [
          { label: "OCCUPIED", value: 1 },
          { label: "READY", value: 1 },
        ],
        costCategories: [],
        detailBasis: ["debt", "overview", "operations"].includes(type)
          ? "CURRENT_SNAPSHOT"
          : "BILLING_PERIOD",
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
    `UI condition timed out: ${expression}; ${await evaluate("JSON.stringify({dialogs:[...document.querySelectorAll('dialog')].map(d=>({open:d.open,text:d.textContent})),main:document.querySelector('main')?.textContent,url:location.href})")}`,
  );
}
const js = (value) => JSON.stringify(value);
async function click(text, scope = "document") {
  await evaluate(
    `(()=>{const el=[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${js(text)}&&e.getClientRects().length);if(!el)throw Error('Button missing: '+${js(text)});el.click()})()`,
  );
}
async function intercept(event) {
  if (
    mode === "slow" &&
    event.request.url.includes("/admin/operations") &&
    event.request.url.includes("propertyId=10")
  )
    await sleep(900);
  if (mode === "loading" && event.request.url.includes("/admin/dashboard"))
    await sleep(2000);
  let status, data;
  try {
    [status, data] = operationApi(event.request);
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
      else if (
        msg.method === "Runtime.consoleAPICalled" &&
        msg.params.type === "error"
      )
        console.error(JSON.stringify(msg.params.args));
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
    await go("/admin/maintenance/assets");
    await until("document.body.innerText.includes('ASSET-A')");
    cases.push("assets-real-api-query-and-table");
    await click("Lịch sử", "document.querySelector('tbody')");
    await until(
      "document.querySelector('dialog[open]')?.innerText.includes('HD501')",
    );
    assert.ok(
      await evaluate(
        "!!document.querySelector('dialog[open] a[href=\"/admin/contracts/501\"]')",
      ),
    );
    await evaluate(
      "document.querySelector('dialog[open] button[aria-label=\"Đóng\"]').click()",
    );
    cases.push("asset-history-links-original-handover-contract");
    await click("Thêm tài sản");
    await choose("dialog[open] select", "101");
    await fill("dialog[open] input[name=code]", "ASSET-NEW");
    await fill("dialog[open] input[name=name]", "New fan fixture");
    await fill("dialog[open] input[name=reason]", "Physical inventory");
    await click("Xác nhận lưu", "document.querySelector(\'dialog[open]\')");
    await until("document.body.innerText.includes('ASSET-NEW')");
    assert.equal(
      posts.filter((p) => p.route === "/admin/operations/assets").length,
      1,
    );
    cases.push("create-asset-persists-and-reloads-server-query");
    mode = "save-error";
    await click("Thêm tài sản");
    await choose("dialog[open] select", "101");
    await fill("dialog[open] input[name=code]", "ASSET-FAIL");
    await fill("dialog[open] input[name=name]", "Failed fan");
    await fill("dialog[open] input[name=reason]", "Physical inventory");
    await click("Xác nhận lưu", "document.querySelector(\'dialog[open]\')");
    await until(
      "document.querySelector('dialog[open]')?.innerText.includes('Fixture save conflict')",
    );
    assert.ok(
      !(await evaluate(
        "document.querySelector('tbody').innerText.includes('ASSET-FAIL')",
      )),
    );
    await click("Hủy", "document.querySelector(\'dialog[open]\')");
    mode = "normal";
    cases.push("failed-save-shows-error-without-success-or-fake-row");
    await click("Kho vật tư");
    await until("document.body.innerText.includes('PART-A')");
    await click("Nhập kho");
    await fill('dialog[open] input[aria-label="Số lượng thực nhận"]', "3");
    await fill("dialog[open] input[name=reason]", "Delivery evidence");
    await click("Xác nhận lưu", "document.querySelector(\'dialog[open]\')");
    await until("!document.querySelector('dialog[open]')");
    const received = posts.find((p) => p.route.endsWith("/91/receive"));
    assert.equal(received.body.quantity, 3);
    assert.ok(received.body.key);
    cases.push("stock-receipt-has-idempotency-key-and-real-quantity");
    await click("Duyệt vật tư");
    await until("document.body.innerText.includes('TASK-A')");
    await click("Duyệt");
    await fill("dialog[open] input[name=reason]", "Approved requirement");
    await click("Xác nhận lưu", "document.querySelector(\'dialog[open]\')");
    await until("!document.querySelector('dialog[open]')");
    assert.ok(
      posts.some(
        (p) =>
          p.route.endsWith("/92/review") &&
          p.body.version === 0 &&
          p.body.approve,
      ),
    );
    cases.push("material-review-preserves-source-version-and-decision");
    await click("Chi phí sửa chữa");
    await until("document.body.innerText.includes('Thực chi:')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('chỉ') || document.body.innerText.includes('Chỉ phiếu')",
      ),
    );
    cases.push("maintenance-cost-separates-proposed-recorded-and-paid");
    mode = "slow";
    await choose('select[aria-label="Phạm vi nhà trọ"]', "10");
    await sleep(80);
    await choose('select[aria-label="Phạm vi nhà trọ"]', "11");
    await click("Tài sản & thiết bị");
    await until("document.body.innerText.includes('ASSET-B')");
    await sleep(1100);
    assert.ok(
      !(await evaluate(
        "document.querySelector('tbody').innerText.includes('ASSET-A')",
      )),
    );
    mode = "normal";
    cases.push("rapid-property-switch-never-restores-old-house");
    await fill('input[aria-label="Tìm tài sản hoặc công việc"]', "not-found");
    await until(
      "document.body.innerText.includes('Chưa có dữ liệu phù hợp bộ lọc.')",
    );
    cases.push("empty-state-retains-filters");
    await fill('input[aria-label="Tìm tài sản hoặc công việc"]', "");
    mode = "error";
    await choose('select[aria-label="Trạng thái"]', "BROKEN");
    await until(
      "document.body.innerText.includes('Fixture operations unavailable')",
    );
    assert.ok(!(await evaluate("!!document.querySelector('tbody')")));
    mode = "normal";
    cases.push("read-failure-hides-old-data-and-offers-retry");
    await go("/admin/maintenance/assets");
    await until(
      "document.body.innerText.includes('ASSET-A') || document.body.innerText.includes('ASSET-B')",
    );
    const out = path.resolve("../docs/qa/operations-redesign");
    fs.mkdirSync(out, { recursive: true });
    let shot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      path.join(out, "desktop.png"),
      Buffer.from(shot.data, "base64"),
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(250);
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
    );
    shot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      path.join(out, "mobile.png"),
      Buffer.from(shot.data, "base64"),
    );
    cases.push("desktop-mobile-no-page-overflow");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    role = "MANAGER";
    await go("/admin/maintenance/assets");
    await until("document.body.innerText.includes('ASSET-A')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('td')].some(e=>e.textContent.includes('—'))",
      ),
    );
    await click("Chi phí sửa chữa");
    await until("document.body.innerText.includes('TASK-A')");
    assert.ok(
      !(await evaluate(
        "[...document.querySelectorAll('tbody button')].some(e=>e.textContent==='Duyệt')",
      )),
    );
    cases.push("manager-redacts-money-and-hides-cost-approval");
    role = "OWNER";
    await go("/admin/accounts");
    await until("document.body.innerText.includes('Technician fixture')");
    await choose("select", "0");
    assert.ok(
      await evaluate(
        "document.querySelector('tbody').innerText.includes('Company A')",
      ),
    );
    assert.ok(
      requests.some(
        (r) => r.route === "/owner/accounts" && r.params.role === "STAFF",
      ),
    );
    cases.push("staff-list-is-separated-from-tenants-and-shows-company");
    await go("/admin/settings");
    await until("document.body.innerText.includes('Fixture operations')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Cấu hình chung hiện thuộc tài khoản chủ nhà')",
      ),
    );
    assert.ok(
      !(await evaluate(
        "!!document.querySelector('a[href=\"/admin/services\"]')",
      )),
    );
    cases.push("settings-shows-scope-and-canonical-editors");
    await go("/admin/settings/ai");
    await until("document.body.innerText.includes('API key:')");
    await click("Kiểm tra cấu hình");
    await until(
      "document.body.innerText.includes('Chưa kiểm tra phản hồi mô hình thực tế.')",
    );
    cases.push("ai-configuration-test-does-not-claim-live-model-connection");
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
  console.error(
    JSON.stringify({ cases, exceptions, requests: requests.slice(-15) }),
  );
  process.exitCode = 1;
});
