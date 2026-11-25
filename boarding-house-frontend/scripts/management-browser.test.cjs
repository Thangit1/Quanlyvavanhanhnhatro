/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/management-browser-profile-");
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
function api(request) {
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

    const go = async (route) => {
      await command("Page.navigate", { url: origin + route });
      await until("!!document.querySelector('main')");
    };
    mode = "loading";
    await go("/owner/dashboard");
    await until("!!document.querySelector('[role=status]')");
    cases.push("Loading skeleton while dashboard API is pending");
    await until(
      "document.body.innerText.includes('Thực thu dịch vụ trong kỳ')",
    );
    await until(
      '!!document.querySelector(\'select[aria-label="Phạm vi nhà trọ"] option[value="11"]\')',
    );
    assert.ok(await evaluate("document.body.innerText.includes('1.234.567')"));
    assert.ok(
      await evaluate(
        "document.querySelector('optgroup[label=\"Fixture Company / Area A\"]')!==null",
      ),
    );
    assert.ok(
      await evaluate(
        "!document.querySelector('input[placeholder=\"Tìm phòng, người thuê...\"]')",
      ),
    );
    cases.push(
      "Owner dashboard uses real API contract fields and company/area option groups",
    );
    mode = "normal";
    fs.mkdirSync("../docs/qa/redesign", { recursive: true });
    const desktop = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/redesign/desktop.png",
      Buffer.from(desktop.data, "base64"),
    );
    await click("Thu gọn");
    assert.ok(
      await evaluate(
        "document.querySelector('button[aria-label=\"Mở rộng sidebar\"]')!==null",
      ),
    );
    await evaluate(
      "document.querySelector('button[aria-label=\"Mở rộng sidebar\"]').click()",
    );
    cases.push("Desktop sidebar collapse and expand");
    await evaluate(
      "(()=>{const el=document.querySelector('header select');el.value='11';el.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await until(
      "document.querySelectorAll('select[aria-label=\"Phạm vi nhà trọ\"]')[0].value==='11'",
    );
    await until(
      "Array.from(document.querySelectorAll('main a')).some(a=>a.textContent.includes('B201')) && !Array.from(document.querySelectorAll('main a')).some(a=>a.textContent.includes('A101'))",
    );
    assert.ok(
      requests.some(
        (r) => r.route === "/admin/dashboard" && r.params.propertyId === "11",
      ),
    );
    cases.push(
      "Header scope refetches dashboard and excludes other properties",
    );
    await evaluate(
      "Array.from(document.querySelectorAll('aside nav a')).find(a=>a.getAttribute('href')==='/admin/rooms').click()",
    );
    await until("document.body.innerText.includes('Danh sách phòng')");
    await until("!!document.querySelector('input[aria-label=\"Tìm phòng\"]')");
    assert.ok(
      requests.some(
        (r) => r.route === "/admin/rooms" && r.params.propertyId === "11",
      ),
    );
    cases.push("Scope persists on client navigation to existing room page");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await go("/owner/dashboard");
    await until(
      "document.body.innerText.includes('Thực thu dịch vụ trong kỳ')",
    );
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+1",
      ),
    );
    await evaluate(
      "document.querySelector('button[aria-label=\"Mở menu\"]').click()",
    );
    await until("document.querySelector('dialog').open");
    await command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await until("!document.querySelector('dialog').open");
    cases.push(
      "390px layout has no page overflow; modal drawer closes on Escape",
    );
    fs.mkdirSync("../docs/qa/redesign", { recursive: true });
    const shot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/redesign/mobile.png",
      Buffer.from(shot.data, "base64"),
    );
    role = "MANAGER";
    await go("/manager/dashboard");
    await until(
      "document.body.innerText.includes('Tổng quan vận hành') && !!document.querySelector('select[aria-label=\"Phạm vi nhà trọ\"] option[value=\"10\"]')",
    );
    await sleep(700);
    assert.ok(
      await evaluate(
        '!document.querySelector(\'a[href="/admin/invoices"]\') && !document.querySelector(\'a[href="/admin/areas"]\') && !document.querySelector(\'select[aria-label="Phạm vi nhà trọ"] option[value="11"]\')',
      ),
    );
    cases.push(
      "Manager without FINANCE_READ cannot see finance menu or unassigned properties",
    );
    role = "OWNER";
    mode = "empty";
    await go("/owner/dashboard");
    await until(
      "document.body.innerText.includes('Tài khoản chưa được gán nhà trọ nào.')",
    );
    cases.push("Empty dashboard state");
    mode = "error";
    await go("/owner/dashboard");
    await until("!!document.querySelector('[role=alert]')", 25000);
    cases.push("Dashboard error with retry");
    mode = "normal";
    await evaluate("document.querySelector('[role=alert] button').click()");
    await until(
      "document.body.innerText.includes('Thực thu dịch vụ trong kỳ')",
    );
    cases.push("Retry recovers dashboard");
    role = "ACCOUNTANT";
    await go("/admin/rooms");
    await until("!!document.querySelector('a[href=\"/accountant/invoices\"]')");
    assert.ok(
      await evaluate(
        "!document.querySelector('a[href=\"/admin/areas\"]') && !document.querySelector('a[href=\"/admin/accounts\"]')",
      ),
    );
    cases.push(
      "Accountant read-only room navigation does not expose owner or manager menus",
    );
    for (const [nextRole, target] of [
      ["TECHNICIAN", "/technician/dashboard"],
      ["TENANT", "/tenant/home"],
    ]) {
      role = nextRole;
      const before = requests.length;
      await go("/owner/dashboard");
      await until(`location.pathname===${JSON.stringify(target)}`);
      assert.ok(
        !requests.slice(before).some((r) => r.route === "/admin/dashboard"),
      );
      cases.push(
        `${nextRole} redirects to its own portal without loading admin data`,
      );
    }
    role = "ANON";
    await go("/owner/dashboard");
    await until("location.pathname==='/login'");
    cases.push("Anonymous user redirected to login");
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
