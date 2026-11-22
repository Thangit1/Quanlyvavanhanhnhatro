/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/rooms-browser-profile-");
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

let failBulk = false,
  failRooms = false;
const sampleProperties = properties.map((p, i) => ({
  ...p,
  propertyCode: "PROP" + p.id,
  address: i ? "Đà Nẵng" : "Hà Nội",
  type: "BOARDING_HOUSE",
  manager: { id: 2, fullName: "Manager A" },
  status: "ACTIVE",
  version: 0,
  totalRooms: 3,
  occupiedRooms: 1,
  vacantRooms: 1,
  reservedRooms: 1,
  maintenanceRooms: 0,
  occupancyRate: 33.3,
  currentRevenue: 1234567,
  outstandingDebt: 1000,
  buildings: [],
  activities: [],
}));
let sampleRooms = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "CLEANING",
  "NOTICE",
].map((status, i) => ({
  id: 101 + i,
  roomCode: "P" + (101 + i),
  name: "Room " + (101 + i),
  propertyId: i < 4 ? 10 : 11,
  propertyName: i < 4 ? "House A" : "House B",
  buildingId: i < 3 ? 20 : undefined,
  buildingName: i < 3 ? "Dãy A" : undefined,
  floorId: i < 3 ? 30 : undefined,
  floorName: i < 3 ? "Tầng 1" : undefined,
  area: 18,
  monthlyRent: 1000000 + i * 500000,
  depositAmount: 0,
  maxOccupants: 2,
  currentOccupants: status === "OCCUPIED" || status === "NOTICE" ? 1 : 0,
  status,
  version: 0,
  updatedAt: "2026-11-17T00:00:00",
  openMaintenanceCount: status === "MAINTENANCE" ? 1 : 0,
  outstandingDebt: status === "OCCUPIED" ? 1000 : 0,
  overdueInvoiceCount: status === "OCCUPIED" ? 1 : 0,
  representativeTenant:
    status === "OCCUPIED"
      ? { id: 5, fullName: "Tenant A", representative: true }
      : null,
  currentContract:
    status === "OCCUPIED"
      ? {
          id: 501,
          code: "HD501",
          startDate: "2026-01-01",
          endDate: "2026-12-01",
          status: "ACTIVE",
        }
      : null,
}));
function api(request) {
  const u = new URL(request.url),
    route = u.pathname.replace(/^\/api/, "");
  if (route.startsWith("/owner/access/properties/"))
    return [
      200,
      {
        assignments: [],
        capabilities: [],
        availableManagers: [],
        properties: [],
      },
    ];
  const write = ["OWNER", "MANAGER"].includes(role),
    props = role === "OWNER" ? sampleProperties : sampleProperties.slice(0, 1);
  const body = request.postData ? JSON.parse(request.postData) : {};
  if (request.method === "OPTIONS") return [204, null];
  const filteredRooms = () =>
    sampleRooms.filter(
      (r) =>
        props.some((p) => p.id === r.propertyId) &&
        (!u.searchParams.get("propertyId") ||
          r.propertyId === Number(u.searchParams.get("propertyId"))) &&
        (!u.searchParams.get("buildingId") ||
          r.buildingId === Number(u.searchParams.get("buildingId"))) &&
        (!u.searchParams.get("floorId") ||
          r.floorId === Number(u.searchParams.get("floorId"))) &&
        (!u.searchParams.get("status") ||
          r.status === u.searchParams.get("status")) &&
        (!u.searchParams.get("keyword") ||
          (r.roomCode + " " + r.name)
            .toLowerCase()
            .includes(u.searchParams.get("keyword").toLowerCase())) &&
        (!u.searchParams.get("minimumRent") ||
          r.monthlyRent >= Number(u.searchParams.get("minimumRent"))) &&
        (!u.searchParams.get("maximumRent") ||
          r.monthlyRent <= Number(u.searchParams.get("maximumRent"))),
    );
  const summary = {
    totalRooms: 6,
    occupiedRooms: 2,
    vacantRooms: 1,
    reservedRooms: 1,
    maintenanceRooms: 1,
    inactiveRooms: 0,
  };
  if (
    route.startsWith("/admin/properties") ||
    route.startsWith("/admin/rooms") ||
    route === "/admin/rental-lifecycle"
  )
    requests.push({
      route,
      method: request.method,
      params: Object.fromEntries(u.searchParams),
      body,
    });
  if (route === "/admin/properties/options")
    return [
      200,
      {
        properties: props.map((p) => ({ id: p.id, label: p.name })),
        buildings: [{ id: 20, label: "Dãy A", parentId: 10 }],
        floors: [{ id: 30, label: "Tầng 1", parentId: 20 }],
        amenities: [],
        contexts: props.map((p) => ({
          propertyId: p.id,
          organizationId: 1,
          organizationName: "Fixture Company",
          areaId: p.id === 10 ? 40 : 41,
          areaName: p.id === 10 ? "Khu Bắc" : "Khu Nam",
          managers: [{ id: 2, fullName: "Manager A" }],
          canReadFinance: role !== "MANAGER",
        })),
      },
    ];
  if (route === "/admin/properties")
    return [
      200,
      {
        summary: {
          totalProperties: props.length,
          activeProperties: props.length,
          totalRooms: 6,
          occupiedRooms: 2,
          vacantRooms: 1,
          maintenanceRooms: 1,
        },
        page: {
          items: props,
          page: 0,
          size: 100,
          totalElements: props.length,
          totalPages: 1,
        },
      },
    ];
  if (/^\/admin\/properties\/\d+$/.test(route))
    return [200, props.find((p) => p.id === Number(route.split("/").pop()))];
  if (route === "/admin/rooms/bulk") {
    if (failBulk)
      return [
        409,
        {
          message: "Mã phòng đã tồn tại. Toàn bộ giao dịch bị hủy.",
          code: "ROOM_CODE_EXISTS",
        },
      ];
    const created = [];
    for (let n = body.fromNumber; n <= body.toNumber; n++) {
      const code = body.prefix + String(n).padStart(body.padding, "0");
      const id = 1000 + n;
      sampleRooms.push({
        ...sampleRooms[0],
        id,
        roomCode: code,
        name: "Phòng " + code,
        propertyId: body.propertyId,
        propertyName: props.find((p) => p.id === body.propertyId).name,
        buildingId: body.buildingId,
        floorId: body.floorId,
        buildingName: null,
        floorName: null,
        monthlyRent: body.monthlyRent,
      });
      created.push({ id, code });
    }
    return [201, created];
  }
  if (route === "/admin/rooms" && request.method === "POST") {
    if (!write) return [403, { message: "Forbidden" }];
    if (
      sampleRooms.some(
        (r) => r.propertyId === body.propertyId && r.roomCode === body.code,
      )
    )
      return [
        409,
        { message: "Mã phòng đã tồn tại.", code: "ROOM_CODE_EXISTS" },
      ];
    const id = 2001;
    sampleRooms.push({
      ...sampleRooms[0],
      ...body,
      id,
      roomCode: body.code,
      monthlyRent: body.monthlyRent,
      propertyName: props.find((p) => p.id === body.propertyId).name,
      buildingName: null,
      floorName: null,
      currentOccupants: 0,
    });
    return [201, { id, code: body.code }];
  }
  if (route === "/admin/rooms") {
    if (failRooms)
      return [503, { message: "Fixture room service unavailable" }];
    const list = filteredRooms(),
      page = Number(u.searchParams.get("page") || 0),
      size = Number(u.searchParams.get("size") || 20);
    return [
      200,
      {
        summary,
        page: {
          items: list.slice(page * size, (page + 1) * size),
          page,
          size,
          totalElements: list.length,
          totalPages: Math.ceil(list.length / size),
        },
      },
    ];
  }
  if (/^\/admin\/rooms\/\d+$/.test(route)) {
    const room = sampleRooms.find(
      (r) => r.id === Number(route.split("/").pop()),
    );
    return [
      200,
      {
        room,
        description: "Real fixture description",
        occupants: room.representativeTenant ? [room.representativeTenant] : [],
        amenities: [],
        assets: [],
        meters: [],
        images: [],
        priceHistory: [],
        statusHistory: [],
        activities: [],
        canEdit: write,
        canChangePrice: write,
        canChangeStatus: write,
        meterManagement: {
          canInstall: false,
          installableTypes: [],
          reason: "Needs physical verification",
          events: [],
        },
      },
    ];
  }
  if (route === "/admin/rental-lifecycle")
    return [
      200,
      {
        summary: {
          reserved: 1,
          awaitingCheckin: 0,
          staying: 1,
          checkoutRequested: 0,
          settlementPending: 0,
          cleaningOrMaintenance: 1,
        },
        properties: props,
        rooms: sampleRooms.map((r) => ({
          id: r.id,
          parentId: r.propertyId,
          name: r.roomCode,
          status: r.status,
        })),
        tenants: [],
        contracts: [],
        bookings: [
          {
            id: 3,
            roomId: 103,
            roomCode: "P103",
            tenantName: "Guest",
            propertyId: 10,
            propertyName: "House A",
            status: "RESERVED",
            reservationEnd: "2026-12-01",
            depositAmount: 0,
            depositStatus: "HELD",
            version: 0,
          },
        ],
        checkins: [],
        checkouts: [],
      },
    ];
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
    async function fillLabel(label, value) {
      const selector = await evaluate(
        '(()=>{const el=[...document.querySelectorAll("label")].find(e=>e.textContent.includes(' +
          JSON.stringify(label) +
          ')&&e.querySelector("input")&&e.getClientRects().length)?.querySelector("input");if(!el)throw Error("Label missing");el.setAttribute("data-test-input","target");return "input[data-test-input=target]"})()',
      );
      await fill(selector, value);
      await evaluate(
        'document.querySelector("input[data-test-input=target]").removeAttribute("data-test-input")',
      );
    }
    await go("/admin/properties");
    await until("document.body.innerText.includes('House B')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Khu Bắc')&&document.body.innerText.includes('Manager A')",
      ),
    );
    cases.push(
      "TC01 Owner sees scoped properties with company, area and assigned manager",
    );
    await fill('input[aria-label="Tỉnh thành trong địa chỉ"]', "Hà Nội");
    await until(
      "!Array.from(document.querySelectorAll('article')).some(a=>a.textContent.includes('House B'))",
    );
    cases.push(
      "Property address filter and card/table views use loaded backend records",
    );
    await click("Dạng bảng");
    await until("!!document.querySelector('main table')");
    await evaluate("document.querySelector('main table summary').click()");
    assert.ok(
      await evaluate(
        "!!document.querySelector('main table details[open] a[href=\"/admin/rooms?propertyId=10\"]')",
      ),
    );
    cases.push(
      "Property table and its expanded action menu remain usable inside the scroll container",
    );
    await go("/admin/rooms?propertyId=10");
    await until(
      "document.body.innerText.includes('P101')&&!!document.querySelector('article details')",
    );
    await until(
      "document.body.innerText.includes('Dãy A / Tầng 1')&&document.body.innerText.includes('1 hóa đơn quá hạn')",
    );
    assert.ok(
      await evaluate(
        "[...document.querySelectorAll('article')].find(a=>a.textContent.includes('P102')).textContent.includes('Đang thuê')",
      ),
    );
    cases.push(
      "TC08 TC09 TC10 Room groups retain independent room, invoice and contract states",
    );
    await evaluate(
      "[...document.querySelectorAll('article')].find(a=>a.textContent.includes('P101')).querySelector('summary').click()",
    );
    assert.ok(
      await evaluate(
        "!!document.querySelector('a[href=\"/admin/contracts/new?propertyId=10&roomId=101\"]')",
      ),
    );
    assert.ok(
      await evaluate(
        "![...document.querySelectorAll('article')].find(a=>a.textContent.includes('P102')).querySelector('a[href*=\"action=booking\"]')",
      ),
    );
    cases.push(
      "Quick actions carry the exact property and room and do not offer rental for occupied rooms",
    );
    await evaluate(
      "(()=>{const el=document.querySelector('select[aria-label=\"Tầng lọc phòng\"]');el.value='30';el.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await until("!document.body.innerText.includes('Room 104')");
    await evaluate(
      "(()=>{const el=document.querySelector('select[aria-label=\"Trạng thái lọc phòng\"]');el.value='RESERVED';el.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
    await until(
      "document.body.innerText.includes('P103')&&!document.body.innerText.includes('Room 101')",
    );
    assert.ok(
      requests.some(
        (r) =>
          r.route === "/admin/rooms" &&
          r.params.floorId === "30" &&
          r.params.status === "RESERVED",
      ),
    );
    await click("Xóa bộ lọc phụ");
    await until("document.body.innerText.includes('P101')");
    cases.push(
      "TC12 Floor and status filters reach the API without merging intermediate states",
    );
    await fill('input[aria-label="Giá thuê từ"]', "2000000");
    await until(
      "requestsPlaceholder".replace(
        "requestsPlaceholder",
        "!document.body.innerText.includes('Room 101')",
      ),
    );
    assert.ok(
      requests.some(
        (r) => r.route === "/admin/rooms" && r.params.minimumRent === "2000000",
      ),
    );
    cases.push("TC12 Server price filter is sent before pagination");
    await click("Xóa bộ lọc phụ");
    await until("document.body.innerText.includes('P101')");
    await click("Thêm nhiều phòng");
    await until("!!document.querySelector('dialog[open]')");
    await fillLabel("Tiền tố", "B");
    await fillLabel("Số bắt đầu", "201");
    await fillLabel("Số lượng", "3");
    await fillLabel("Giá thuê chung", "1200000");
    await until(
      "document.querySelector('dialog[open]').textContent.includes('B201, B202, B203')",
    );
    await evaluate(
      "document.querySelector('dialog input[type=checkbox]').click()",
    );
    failBulk = true;
    await evaluate("document.querySelector('dialog form').requestSubmit()");
    await until("!!document.querySelector('dialog [role=alert]')");
    assert.equal(
      sampleRooms.some((r) => r.roomCode === "B201"),
      false,
    );
    cases.push(
      "TC18 Failed bulk creation keeps the draft, shows error and never claims success",
    );
    failBulk = false;
    await evaluate("document.querySelector('dialog form').requestSubmit()");
    await until(
      "!document.querySelector('dialog[open]')&&document.body.innerText.includes('Đã tạo thành công 3 phòng')",
    );
    assert.equal(sampleRooms.filter((r) => /^B20/.test(r.roomCode)).length, 3);
    assert.ok(
      requests
        .filter((r) => r.route === "/admin/rooms/bulk")
        .every((r) => !r.body.buildingId && !r.body.floorId),
    );
    cases.push(
      "TC05 Bulk preview submits one transactional API request with optional hierarchy",
    );
    await evaluate(
      "window.__exportText='';const original=URL.createObjectURL;URL.createObjectURL=(blob)=>{blob.text().then(t=>window.__exportText=t);return original(blob)}",
    );
    await click("Xuất CSV (Excel)");
    await until("window.__exportText.includes('B201')");
    assert.ok(await evaluate("!window.__exportText.includes('House B')"));
    cases.push(
      "CSV export uses current property filters without unrelated tenant data",
    );
    await go("/admin/rooms/new?propertyId=10");
    await until("document.body.innerText.includes('Lưu phòng')");
    await fillLabel("Mã phòng", "P101");
    await fillLabel("Tên phòng", "Test Single");
    await fillLabel("Giá thuê/tháng", "1200000");
    await evaluate("document.querySelector('main form').requestSubmit()");
    await until("document.body.innerText.includes('Mã phòng đã tồn tại.')");
    cases.push("TC04 Duplicate room error keeps the single-room form");
    await fillLabel("Mã phòng", "Z900");
    await evaluate("document.querySelector('main form').requestSubmit()");
    await until(
      "location.pathname==='/admin/rooms/2001' && document.body.innerText.includes('Z900')",
    );
    assert.ok(
      requests.some(
        (r) =>
          r.route === "/admin/rooms" &&
          r.method === "POST" &&
          r.body.code === "Z900" &&
          !r.body.buildingId &&
          !r.body.floorId,
      ),
    );
    cases.push(
      "TC03 Single room form creates without invented building, floor or meters",
    );
    await go("/admin/rooms/102");
    await until("document.body.innerText.includes('HD501')");
    await click("Hợp đồng");
    assert.ok(
      await evaluate(
        "!!document.querySelector('main a[href=\"/admin/contracts/501\"]')",
      ),
    );
    await click("Điện nước");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Chưa khai báo')||document.body.innerText.includes('đồng hồ')",
      ),
    );
    cases.push(
      "Room detail tabs link to the exact contract and preserve undeclared meter state",
    );
    await go("/admin/properties/10?tab=map");
    await until("document.body.innerText.includes('P101')");
    assert.ok(
      await evaluate(
        "document.body.innerText.includes('Quản lý phòng')||document.body.innerText.includes('Sơ đồ phòng')",
      ),
    );
    cases.push("Property detail embeds the existing room workspace");
    fs.mkdirSync("../docs/qa/rooms-redesign", { recursive: true });
    await evaluate("window.scrollTo(0,600)");
    const desktop = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/rooms-redesign/desktop.png",
      Buffer.from(desktop.data, "base64"),
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await go("/admin/rooms?propertyId=10");
    await until("document.body.innerText.includes('P101')");
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
    );
    cases.push("TC16 Mobile room workspace fits 390px");
    fs.mkdirSync("../docs/qa/rooms-redesign", { recursive: true });
    const shot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/rooms-redesign/mobile.png",
      Buffer.from(shot.data, "base64"),
    );
    await evaluate(
      "const card=document.querySelector('main article details').closest('article');window.scrollTo(0,card.getBoundingClientRect().top+scrollY-180)",
    );
    const cardsShot = await command("Page.captureScreenshot", {
      format: "png",
    });
    fs.writeFileSync(
      "../docs/qa/rooms-redesign/mobile-cards.png",
      Buffer.from(cardsShot.data, "base64"),
    );
    await click("Thêm nhiều phòng");
    await until("!!document.querySelector('dialog[open]')");
    assert.ok(
      await evaluate(
        "document.querySelector('dialog[open]').getBoundingClientRect().width<=innerWidth",
      ),
    );
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
    await until("!document.querySelector('dialog[open]')");
    cases.push(
      "Bulk modal fits mobile and supports Escape without writing data",
    );
    role = "MANAGER";
    await go("/admin/properties");
    await until("document.body.innerText.includes('House A')");
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('House B')&&!document.body.innerText.includes('Thực thu tháng')",
      ),
    );
    cases.push(
      "TC02 Manager sees only assigned properties and no finance when denied",
    );
    role = "ACCOUNTANT";
    await go("/admin/rooms");
    await until("document.body.innerText.includes('P101')");
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('Thêm nhiều phòng')&&!document.querySelector('main a[href*=\"/edit\"]')",
      ),
    );
    cases.push(
      "Accountant read-only room workspace hides edits and bulk creation",
    );
    role = "OWNER";
    failRooms = true;
    await go("/admin/rooms");
    await until("!!document.querySelector('[role=alert]')", 25000);
    assert.ok(
      await evaluate(
        "!!document.querySelector('input[aria-label=\"Tìm phòng\"]')",
      ),
    );
    cases.push("Error state retains filters and retry controls");
    failRooms = false;
    await evaluate("document.querySelector('[role=alert] button').click()");
    await until("document.body.innerText.includes('P101')");
    cases.push("TC17 Retry and reload reflect API room states");
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
