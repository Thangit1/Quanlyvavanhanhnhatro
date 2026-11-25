/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/utilities-browser-profile-");
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

let warningPolicy = { highMultiplier: 3, warnZero: true, version: 0 };
let failSecond = true,
  failNetwork = false;
let bulkRequests = [];
const makeRow = (id, room, oldE, oldW) => ({
  id,
  code: "HD" + id,
  room_id: room,
  room_code: "P" + room,
  tenant_name: "Tenant " + id,
  canWrite: true,
  locked: false,
  policies: [
    {
      code: "ELECTRICITY",
      calculation_method: "METER",
      effectivePrice: 3500,
      unit: "kWh",
    },
    {
      code: "WATER",
      calculation_method: "METER",
      effectivePrice: 20000,
      unit: "m³",
    },
  ],
  replacements: [],
  comparison: { electricity_consumption: 10, water_consumption: 10 },
  detail: {
    contract: {
      id,
      agreed_monthly_rent: 1000000,
      rent_proration: "FULL_MONTH",
    },
    reading: null,
    previous: { ELECTRICITY: oldE, WATER: oldW },
    meters: [
      {
        id: room * 10,
        meter_type: "ELECTRICITY",
        meter_code: "E" + room,
        current_reading: oldE,
        status: "ACTIVE",
      },
      {
        id: room * 10 + 1,
        meter_type: "WATER",
        meter_code: "W" + room,
        current_reading: oldW,
        status: "ACTIVE",
      },
    ],
    rates: [],
    services: [],
    rateHistory: [],
    revisions: [],
    runs: [],
    automation: [],
  },
});
const utilityRows = [makeRow(501, 101, 1250, 250), makeRow(502, 102, 100, 10)];
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, "");
  if (request.method === "OPTIONS") return [204, null];
  if (route === "/admin/properties/options")
    return [
      200,
      {
        properties: properties.map((p) => ({ id: p.id, label: p.name })),
        contexts: [
          {
            propertyId: 10,
            organizationId: 1,
            organizationName: "Company A",
            areaId: 2,
            areaName: "Area A",
            managers: [],
            canReadFinance: true,
          },
        ],
        buildings: [],
        floors: [],
        amenities: [],
      },
    ];
  if (route.endsWith("/monthly-billing/workspace"))
    return [
      200,
      {
        propertyId: 10,
        period: u.searchParams.get("period"),
        warningPolicy,
        canWrite: role !== "ACCOUNTANT",
        rows: utilityRows.map((r) => ({
          ...r,
          canWrite: role !== "ACCOUNTANT",
        })),
      },
    ];
  if (route === "/admin/monthly-billing/workspace/warning-policy") {
    const body = JSON.parse(request.postData);
    warningPolicy = {
      highMultiplier: body.highMultiplier,
      warnZero: body.warnZero,
      version: warningPolicy.version + 1,
    };
    return [200, null];
  }
  if (route === "/admin/monthly-billing/workspace/readings") {
    const payload = JSON.parse(request.postData);
    bulkRequests.push(payload);
    if (failNetwork)
      return [503, { message: "Không kết nối được máy chủ ghi số" }];
    return [
      200,
      payload.rows.map((line, index) => {
        if (line.contractId === 502 && failSecond)
          return {
            index,
            contractId: 502,
            success: false,
            code: "READING_VERSION_CONFLICT",
            message: "Phiên bản đã thay đổi; đối chiếu lại",
          };
        const row = utilityRows.find((r) => r.id === line.contractId);
        row.detail.reading = {
          version: line.reading.version + 1,
          reading_status: "CONFIRMED",
          electricity_current: line.reading.electricity,
          water_current: line.reading.water,
          electricity_consumption: 10,
          water_consumption: 10,
          electricity_amount: 35000,
          water_amount: 200000,
        };
        return {
          index,
          contractId: line.contractId,
          success: true,
          reading: row.detail.reading,
        };
      }),
    ];
  }
  if (route === "/admin/contracts")
    return [
      200,
      {
        summary: { total: 2 },
        properties,
        page: {
          content: utilityRows.map((r) => ({ id: r.id, contractCode: r.code })),
          page: 0,
          size: 20,
          totalElements: 2,
          totalPages: 1,
        },
      },
    ];
  if (route === "/admin/invoices/bulk-preview") {
    requests.push({
      route,
      method: request.method,
      body: JSON.parse(request.postData),
    });
    return [
      200,
      utilityRows.map((r) => ({
        roomId: r.room_id,
        roomCode: r.room_code,
        tenantName: r.tenant_name,
        estimatedAmount: 1235000,
        status: "READY",
      })),
    ];
  }
  if (/^\/admin\/properties\/10\/services$/.test(route))
    return [
      200,
      {
        items: [
          {
            id: 1,
            code: "WIFI",
            name: "Wi-Fi",
            category: "OTHER",
            calculation_method: "FIXED",
            unit_price: 50000,
            unit: "tháng",
            quantity: 1,
            billing_cycle: "MONTHLY",
            status: "ACTIVE",
            is_default: true,
            allow_price_override: false,
            version: 0,
          },
        ],
        canConfigure: true,
        canOverride: true,
        history: [],
      },
    ];
  if (/^\/(admin|accountant)\/monthly-billing\/50[12]$/.test(route)) {
    const row = utilityRows.find(
      (r) => r.id === Number(route.split("/").pop()),
    );
    return [200, { ...row.detail }];
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

    await go("/admin/reports/utilities?propertyId=10");
    await until("document.body.innerText.includes('Phòng cần ghi điện')");
    cases.push("Scoped period overview counts actual metered contracts");
    await click("Ghi chỉ số");
    await until(
      "!!document.querySelector('input[aria-label=\"Chỉ số ELECTRICITY phòng P101\"]')",
    );
    assert.ok(
      await evaluate(
        "document.querySelector('main').innerText.includes('1250')",
      ),
    );
    cases.push("Previous readings come from backend, not zero defaults");
    await fill('input[aria-label="Chỉ số ELECTRICITY phòng P101"]', "1200");
    await until("document.body.innerText.includes('Chỉ số mới nhỏ hơn')");
    cases.push("Decreasing ordinary reading is explained inline");
    await fill('input[aria-label="Chỉ số ELECTRICITY phòng P101"]', "1260");
    await fill('input[aria-label="Chỉ số ELECTRICITY phòng P102"]', "110");
    for (const room of [101, 102]) {
      await fill(
        'input[aria-label="Chứng từ phòng P' + room + '"]',
        "PHOTO-" + room,
      );
      await fill(
        'input[aria-label="Lý do phòng P' + room + '"]',
        "Đã đối chiếu thực tế",
      );
    }
    await evaluate(
      "(()=>{const s=document.querySelector('select[aria-label=\"Loại chỉ số\"]');s.value='WATER';s.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await fill('input[aria-label="Chỉ số WATER phòng P101"]', "260");
    await fill('input[aria-label="Chỉ số WATER phòng P102"]', "20");
    await click("Lưu nháp trên thiết bị");
    assert.equal(bulkRequests.length, 0);
    cases.push("Typing and saving a local draft do not post official readings");
    await click("Lịch sử chỉ số");
    await click("Ghi chỉ số");
    assert.equal(
      await evaluate(
        "document.querySelector('input[aria-label=\"Chỉ số WATER phòng P101\"]').value",
      ),
      "260",
    );
    cases.push("Unsaved readings survive tab changes");
    await command("Page.reload");
    await until("document.body.innerText.includes('Phòng cần ghi điện')");
    await click("Ghi chỉ số");
    await click("Nạp nháp");
    await until("document.body.innerText.includes('Đã nạp nháp')");
    cases.push("Explicit device draft reload retains captured versions");
    await click("Chốt chỉ số hợp lệ");
    await until("document.body.innerText.includes('Đã chốt 1/2')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Phiên bản đã thay đổi')",
      ),
    );
    assert.equal(bulkRequests.length, 1);
    cases.push("Partial success reports one committed and one failed contract");
    failSecond = false;
    await click("Chốt chỉ số hợp lệ");
    await until("document.body.innerText.includes('Đã chốt 1/1')");
    assert.deepEqual(
      bulkRequests[1].rows.map((r) => r.contractId),
      [502],
    );
    cases.push("Retry sends failed rows only, not successful rooms");
    await fill('input[aria-label="Chỉ số ELECTRICITY phòng P101"]', "1270");
    await fill('input[aria-label="Chứng từ phòng P101"]', "PHOTO-RETRY");
    await fill('input[aria-label="Lý do phòng P101"]', "Đối chiếu lại");
    failNetwork = true;
    await click("Chốt chỉ số hợp lệ");
    await until(
      "document.body.innerText.includes('Không kết nối được máy chủ ghi số')",
    );
    assert.ok(
      !(await evaluate("document.body.innerText.includes('Đã chốt 1/1')")),
    );
    cases.push(
      "Network failure keeps draft and does not report successful confirmation",
    );
    failNetwork = false;
    await click("Chốt chỉ số hợp lệ");
    await until("document.body.innerText.includes('Đã chốt 1/1')");
    await click("Kiểm tra & chốt kỳ");
    await click("Xem trước phí từ backend");
    await until("document.body.innerText.includes('READY')");
    assert.ok(requests.some((r) => r.route === "/admin/invoices/bulk-preview"));
    assert.ok(
      !requests.some(
        (r) => r.route === "/admin/invoices" && r.method === "POST",
      ),
    );
    cases.push(
      "Cost preview uses invoice calculator without issuing an invoice",
    );
    await click("Đơn giá & định mức");
    await until("!!document.querySelector('input[name=ratio]')");
    await fill("input[name=ratio]", "2.5");
    await fill("input[name=reason]", "Reviewed property threshold");
    await evaluate(
      "document.querySelector('input[name=ratio]').form.requestSubmit()",
    );
    await until(
      "document.body.innerText.includes('Đã lưu ngưỡng rà soát theo nhà trọ')",
    );
    assert.equal(warningPolicy.highMultiplier, 2.5);
    cases.push(
      "Owner configures versioned review rules for the selected property",
    );
    await click("Danh mục dịch vụ");
    await until("document.body.innerText.includes('Wi-Fi')");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('main input[type=checkbox]:not([hidden])').length",
      ),
      2,
    );
    cases.push(
      "Catalog reuses configuration editor without fake contract selection",
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await click("Ghi chỉ số");
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
    );
    cases.push("Mobile table scrolls inside workspace without page overflow");
    role = "ACCOUNTANT";
    await go("/admin/reports/utilities?propertyId=10");
    await until("document.body.innerText.includes('Phòng cần ghi điện')");
    await click("Ghi chỉ số");
    assert.ok(
      await evaluate(
        "!Array.from(document.querySelectorAll('main button')).some(b=>b.textContent.includes('Chốt chỉ số hợp lệ'))",
      ),
    );
    cases.push("Accountant has a read-only workspace");
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
