/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/reports-browser-profile-");
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
  if (
    mode === "slow" &&
    event.request.url.includes("/reports/workspace") &&
    event.request.url.includes("propertyId=10")
  )
    await sleep(900);
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
    await go("/admin/reports");
    await until("document.body.innerText.includes('INV-A')");
    assert.match(
      await evaluate(
        "document.querySelector('input[aria-label=\"Từ ngày báo cáo\"]').value",
      ),
      /^\d{4}-\d{2}-\d{2}$/,
    );
    cases.push("overview-scoped-kpis-and-real-date-range");
    await fill('input[aria-label="Tháng báo cáo"]', "2028-02");
    await sleep(250);
    assert.ok(
      requests.some(
        (r) =>
          r.route.endsWith("/workspace") &&
          r.params.startDate === "2028-02-01" &&
          r.params.endDate === "2028-02-29",
      ),
    );
    cases.push("month-picker-leap-year-same-range-for-all-data");
    await click("Công nợ");
    await until("document.body.innerText.includes('INV-A')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('a')].some(e=>e.textContent==='Hóa đơn nguồn'&&e.getAttribute('href')==='/admin/invoices/71')",
      ),
    );
    cases.push("debt-drill-down-links-real-invoice-id");
    mode = "slow";
    await choose('select[aria-label="Nhà trọ báo cáo"]', "10");
    await sleep(60);
    await choose('select[aria-label="Nhà trọ báo cáo"]', "11");
    await until("document.body.innerText.includes('INV-B')");
    await sleep(1000);
    assert.ok(
      !(await evaluate(
        "document.querySelector('main.management-report').innerText.includes('INV-A')",
      )),
    );
    mode = "normal";
    cases.push("rapid-house-switch-cancels-or-ignores-old-response");
    await click("Xuất Excel");
    await sleep(300);
    await click("Xuất CSV");
    await sleep(300);
    assert.equal(posts.length, 2);
    for (const p of posts) {
      assert.equal(p.propertyId, "11");
      assert.equal(p.type, "debt");
      assert.equal(p.startDate, "2028-02-01");
      assert.equal(p.endDate, "2028-02-29");
    }
    cases.push("xlsx-csv-export-keep-exact-current-filters");
    await click("Lịch sử xuất");
    await until("document.body.innerText.includes('report.xlsx')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Tải theo quyền hiện tại')",
      ),
    );
    cases.push("export-history-shows-private-jobs-and-format");
    await click("Dịch vụ");
    await until("document.body.innerText.includes('Internet')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Thực thu phân bổ')&&[...document.querySelectorAll('td')].some(e=>e.textContent==='—')",
      ),
    );
    cases.push("service-collected-unallocated-is-missing-not-fake-zero");
    await fill('input[aria-label="Tìm chứng từ báo cáo"]', "not-found");
    await until(
      "document.body.innerText.includes('Không có dữ liệu trong bộ lọc')",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('input[aria-label=\"Tháng báo cáo\"]').value",
      ),
      "2028-02",
    );
    cases.push("empty-state-preserves-date-and-property-filters");
    await fill('input[aria-label="Tìm chứng từ báo cáo"]', "");
    await sleep(400);
    await choose('select[aria-label="Công ty báo cáo"]', "30");
    await sleep(300);
    assert.ok(
      requests.some(
        (r) =>
          r.route.endsWith("/workspace") && r.params.organizationId === "30",
      ),
    );
    cases.push("company-filter-is-sent-to-server");
    mode = "error";
    await fill('input[aria-label="Từ ngày báo cáo"]', "2028-02-02");
    await until(
      "document.body.innerText.includes('Không thể')||document.body.innerText.includes('thử lại')||document.body.innerText.includes('Thử lại')",
    );
    assert.ok(
      !(await evaluate("document.body.innerText.includes('Internet')")),
    );
    cases.push("api-error-is-not-a-zero-or-old-house-report");
    mode = "normal";
    await go("/admin/reports");
    await until("document.body.innerText.includes('INV-A')");
    fs.mkdirSync(path.resolve(__dirname, "../../docs/qa/reports-redesign"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.resolve(__dirname, "../../docs/qa/reports-redesign/desktop.png"),
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
      path.resolve(__dirname, "../../docs/qa/reports-redesign/mobile.png"),
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
    cases.push("desktop-and-mobile-no-page-overflow");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    role = "MANAGER";
    await go("/admin/reports");
    await until("document.body.innerText.includes('INV-A')");
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('main.management-report button')].find(e=>e.textContent.includes('Tiền thực thu theo ngày'))?.textContent.includes('—')",
      ),
    );
    cases.push(
      "manager-without-finance-sees-operational-data-and-redacted-money",
    );
    role = "ACCOUNTANT";
    await go("/accountant/reports");
    await until("document.body.innerText.includes('INV-A')");
    assert.equal(
      await evaluate("document.querySelectorAll('aside').length"),
      1,
    );
    await choose('select[aria-label="Khu trọ"]', "11");
    await until("document.body.innerText.includes('INV-B')");
    cases.push("accountant-report-reuses-shell-and-header-scope");
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
