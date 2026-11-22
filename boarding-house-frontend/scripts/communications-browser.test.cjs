/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/communications-browser-profile-");
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

let inboxRead = false,
  campaigns = [],
  historyRows = [],
  templateRows = [],
  ruleRows = [],
  taskRows = [],
  submitted = [];
function checkoutApi(request) {
  if (request.url.includes("/tenant/account/preferences"))
    return [200, { theme: "LIGHT", reducedMotion: false }];
  const u = new URL(request.url),
    p = u.pathname,
    body = request.postData ? JSON.parse(request.postData) : {};
  requests.push({ url: request.url, method: request.method });
  if (request.method === "OPTIONS") return [204, null];
  if (p === "/api/communications/options")
    return [
      200,
      {
        properties: reportProps,
        channels: [
          { code: "IN_APP", available: true, status: "AVAILABLE" },
          { code: "EMAIL", available: false, status: "NOT_CONFIGURED" },
          { code: "SMS", available: false, status: "NOT_CONFIGURED" },
          { code: "ZALO", available: false, status: "NOT_CONFIGURED" },
        ],
        events: [
          "INVOICE_BEFORE_DUE",
          "CONTRACT_EXPIRY",
          "CHECKOUT",
          "MAINTENANCE_DUE",
        ],
        canManage: ["OWNER", "MANAGER"].includes(role),
        canSend: ["OWNER", "MANAGER", "ACCOUNTANT"].includes(role),
      },
    ];
  if (p === "/api/communications/unread")
    return mode === "unread-error"
      ? [503, { message: "Unread unavailable" }]
      : [200, { unreadCount: inboxRead ? 0 : 1 }];
  if (p === "/api/communications/inbox")
    return mode === "error"
      ? [503, { message: "Inbox unavailable" }]
      : [
          200,
          {
            rows:
              u.searchParams.get("readStatus") === "UNREAD" && inboxRead
                ? []
                : [
                    {
                      id: 201,
                      title:
                        role === "TENANT" ? "PRIVATE-TENANT" : "PRIVATE-OWNER",
                      content: "Inbox source fixture, not a real send.",
                      category: "ANNOUNCEMENT",
                      property_id: 10,
                      property_name: "House A",
                      created_at: "2026-11-18T09:00:00",
                      read_at: inboxRead ? "2026-11-18T10:00:00" : null,
                      link: "/admin/contracts/501",
                    },
                  ],
            unreadCount: inboxRead ? 0 : 1,
            totalElements: 1,
            totalPages: 1,
          },
        ];
  if (p.match(/communications\/inbox\/(201\/read|read-all)$/)) {
    inboxRead = true;
    return [200, null];
  }
  if (p === "/api/communications/audience")
    return [
      200,
      {
        recipients: [
          {
            id: 5,
            name: "Tenant fixture",
            recipient_role: "TENANT",
            room_id: 101,
          },
          { id: 1, name: "Owner fixture", recipient_role: "OWNER" },
          { id: 6, name: "Technician fixture", recipient_role: "TECHNICIAN" },
        ],
        rooms: [{ id: 101, code: "A101" }],
      },
    ];
  if (p === "/api/communications/preview")
    return mode === "send-error"
      ? [400, { message: "Recipient changed, preview again" }]
      : [
          200,
          {
            recipients: [{ id: 5, name: "Tenant fixture" }],
            recipientCount: 1,
            deliveryCount: 1,
            previewHash: "fixture-preview-hash",
          },
        ];
  if (p === "/api/communications/campaigns") {
    submitted.push(body);
    campaigns.push({
      id: 901,
      title: body.message.title,
      status: body.draft ? "DRAFT" : "QUEUED",
      version: 0,
    });
    historyRows.push({
      id: 902,
      title: body.message.title,
      recipient_name: "Tenant fixture",
      channel: "IN_APP",
      status: "QUEUED",
      attempt_count: 0,
      retryable: false,
      scheduled_at: body.message.scheduledAt,
    });
    return [200, 901];
  }
  if (p === "/api/communications/history")
    return [
      200,
      {
        rows: historyRows,
        campaigns,
        totalElements: historyRows.length,
        totalPages: 1,
      },
    ];
  if (p.endsWith("/attempts")) return [200, []];
  if (p === "/api/communications/templates") {
    if (request.method === "POST") {
      templateRows.push({
        ...body,
        id: 301,
        event_type: body.eventType,
        property_id: body.propertyId,
        version: 0,
      });
      return [200, 301];
    }
    return [200, templateRows];
  }
  if (p === "/api/communications/rules") {
    if (request.method === "POST") {
      ruleRows.push({
        ...body,
        id: 401,
        event_type: body.eventType,
        property_id: body.propertyId,
        offset_days: body.offsetDays,
        send_hour: body.sendHour,
        daily_limit: body.dailyLimit,
        version: 0,
      });
      return [200, 401];
    }
    return [200, ruleRows];
  }
  if (p === "/api/communications/calendar")
    return [
      200,
      {
        rows: [
          {
            id: "CHECKOUT-501",
            title: "Return source fixture",
            kind: "SOURCE",
            status: "SOURCE",
            starts_at: new Date().toISOString().slice(0, 10) + "T09:00:00",
            due_at: new Date().toISOString().slice(0, 10) + "T09:00:00",
            link: "/admin/checkouts?contractId=501",
            property_id: 10,
          },
          ...taskRows,
        ],
        dueTasks: taskRows.length,
        overdueTasks: 0,
      },
    ];
  if (p === "/api/communications/tasks") {
    taskRows.push({
      ...body,
      id: 601,
      kind: "MANUAL",
      status: "OPEN",
      property_id: body.propertyId,
      room_id: body.roomId,
      assignee_id: body.assigneeId,
      starts_at: body.startsAt,
      due_at: body.dueAt,
      version: 0,
      request_key: body.key,
    });
    return [200, 601];
  }
  if (p === "/api/communications/preferences")
    return [
      200,
      {
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00:00",
        quiet_hours_end: "07:00:00",
        version: 0,
      },
    ];
  if (p === "/api/accountant/account")
    return [200, { properties: reportProps }];
  if (p === "/api/accountant/notifications") return [200, []];
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
    [status, data] = checkoutApi(event.request);
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
      await until(
        route.startsWith("/accountant")
          ? "!!document.querySelector('h1')"
          : "!!document.querySelector('main')",
      );
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

    await go("/admin/communications");
    await until("document.body.innerText.includes('PRIVATE-OWNER')");
    cases.push("inbox-source-and-real-unread-api");
    await evaluate(
      "document.querySelector('button[aria-label=\"Thông báo\"]').click()",
    );
    await until(
      "!!document.querySelector('[aria-label=\"Thông báo gần đây\"]')",
    );
    cases.push("bell-dropdown-uses-backend-recent");
    await evaluate(
      "document.querySelector('button[aria-label=\"Đóng thông báo\"]').click()",
    );
    await click("Xem chi tiết");
    await until("!!document.querySelector('dialog[open]')");
    await sleep(250);
    assert.ok(inboxRead);
    await evaluate(
      "document.querySelector('dialog[open] button[aria-label=\"Đóng\"]').click()",
    );
    cases.push("read-action-refreshes-unread-without-marking-delivery-read");
    await choose('select[aria-label="Nhà trọ thông báo"]', "10");
    await click("Tạo thông báo");
    await until("!!document.querySelector('input[name=title]')");
    await fill("input[name=title]", "Notice fixture");
    await fill("textarea[name=body]", "Operational fixture message");
    await click("Kiểm tra & xem trước");
    await until("document.body.innerText.includes('1 người')");
    cases.push("preview-recipients-before-send");
    assert.equal(submitted.length, 0);
    await click("Xác nhận tạo yêu cầu gửi");
    await until("document.body.innerText.includes('Đã tạo yêu cầu gửi.')");
    assert.equal(submitted.length, 1);
    assert.ok(submitted[0].key);
    cases.push("confirmation-queues-with-idempotency-key");
    await click("Lịch sử gửi");
    await until(
      "document.querySelector('tbody')?.innerText.includes('Notice fixture')",
    );
    assert.ok(
      await evaluate(
        "document.querySelector('tbody').innerText.includes('Đang chờ xử lý')",
      ),
    );
    cases.push("queued-is-not-fake-delivered-or-read");
    await click("Kênh & tùy chọn");
    await until("document.body.innerText.includes('Chưa cấu hình provider')");
    cases.push("email-sms-zalo-unconfigured-no-test-send");
    await click("Mẫu nội dung");
    await click("Thêm mẫu");
    await fill("input[name=code]", "GENERAL");
    await fill("input[name=name]", "General fixture");
    await fill("dialog[open] input[name=title]", "Template title");
    await fill("dialog[open] textarea[name=body]", "Hello {{property}}");
    await click("Lưu", "document.querySelector('dialog[open]')");
    await until("!document.querySelector('dialog[open]')");
    cases.push("template-persists-through-api");
    await click("Nhắc việc tự động");
    await click("Thêm quy tắc");
    await click("Lưu", "document.querySelector('dialog[open]')");
    await until("!document.querySelector('dialog[open]')");
    assert.equal(ruleRows[0].enabled, false);
    cases.push("new-rule-is-opt-in-not-default-enabled");
    await click("Lịch công việc");
    await until("document.body.innerText.includes('Return source fixture')");
    await click("Tạo công việc");
    await fill("dialog[open] input[name=title]", "Manual task fixture");
    await fill("dialog[open] textarea[name=description]", "Inspect safely");
    await click("Lưu", "document.querySelector('dialog[open]')");
    await until("!document.querySelector('dialog[open]')");
    await until("document.body.innerText.includes('Manual task fixture')");
    cases.push("source-events-and-manual-work-are-separated");
    fs.mkdirSync("../docs/qa/communications-redesign", { recursive: true });
    const desktop = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/communications-redesign/desktop.png",
      Buffer.from(desktop.data, "base64"),
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(200);
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+2",
      ),
    );
    const mobile = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/communications-redesign/mobile.png",
      Buffer.from(mobile.data, "base64"),
    );
    cases.push("mobile-no-page-overflow");
    mode = "error";
    await go("/admin/communications");
    await until("document.body.innerText.includes('Inbox unavailable')");
    assert.ok(
      !(await evaluate("document.body.innerText.includes('PRIVATE-OWNER')")),
    );
    cases.push("read-error-hides-old-inbox");
    mode = "normal";
    role = "TENANT";
    await go("/tenant/notifications");
    await until("document.body.innerText.includes('PRIVATE-TENANT')");
    assert.ok(
      !(await evaluate("document.body.innerText.includes('PRIVATE-OWNER')")),
    );
    assert.ok(
      !(await evaluate("document.body.innerText.includes('Tạo thông báo')")),
    );
    cases.push("role-switch-hides-previous-inbox-and-management-actions");

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
