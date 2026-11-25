/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated browser fixtures only. No writes to the live API or user browser profile.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const origin = process.env.MANAGEMENT_BROWSER_ORIGIN || "http://localhost:3000";
const profile = fs.mkdtempSync("D:/DATN/checkouts-browser-profile-");
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
function checkoutApi(request) {
  requests.push({ url: request.url, method: request.method });
  if (request.method === "OPTIONS") return [204, null];
  if (
    mode === "error" &&
    request.url.includes("/checkout-workspace") &&
    !request.url.includes("/options")
  )
    return [500, { message: "Checkout read failed" }];
  const u = new URL(request.url),
    p = u.pathname;
  if (p.includes("/deposit-ledger")) return [200, []];
  if (p.endsWith("/accountant/account")) return [200,{properties:reportProps}];
  if (p.endsWith("/accountant/notifications")) return [200,[]];
  if (p.includes("/checkout-workspace/options"))
    return [
      200,
      {
        properties: reportProps,
        rooms: [{ id: 101, code: "A101", propertyId: 10 }],
        contracts: [],
        staff: [],
        assignees: [],
        canRequest: true,
      },
    ];
  if (p.endsWith("/checkout-workspace"))
    return [
      200,
      {
        rows: [
          {
            id: 701,
            code: "CO-701",
            contract_id: 501,
            contract_code: "HD501",
            property_id: 10,
            property_name: "House A",
            room_id: 101,
            room_code: "A101",
            tenant_name: "Tenant fixture",
            status: "REQUESTED",
            stage: "INSPECTION",
            financial_status: "REFUND_PENDING",
            requested_date: "2026-11-18",
            current_debt: 0,
            held_deposit: 1000000,
            can_open: true,
            version: 1,
          },
        ],
        summary: [{ stage: "INSPECTION", count: 1 }],
        totalElements: 1,
        totalPages: 1,
        page: 0,
      },
    ];
  if (p.includes("/checkout-evidence/")) return [200, []];
  if (
    p.includes("/checkout-settlement/") ||
    p.includes("/checkout-settlements/")
  )
    return [
      200,
      {
        contractId: 501,
        contractCode: "HD501",
        timing: {
          classification: "ON_TIME",
          shortNotice: false,
          noticeGiven: 30,
          noticeRequired: 30,
        },
        initialKeys: 1,
        inspectionVersion: null,
        inspectionConfirmations: [],
        approved: null,
        confirmations: [],
        completionCharges: [],
        checkout: {
          id: 701,
          status: "REQUESTED",
          version: 1,
          requested_date: "2026-11-18",
        },
        permissions: {
          canManage: true,
          canApprove: true,
          canApply: true,
          canClose: true,
          canRequest: true,
        },
        initialAssets: [],
        inspection: [],
        charges: [],
        history: [],
        disputes: [],
        rates: [],
        versions: [],
        obligations: [],
        approvedLines: [],
        refunds: [],
        transactions: [],
        blockers: ["Chưa kiểm kê."],
        currentDebt: 0,
        depositBalance: 1000000,
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
      await until(route.startsWith("/accountant") ? "!!document.querySelector('h1')" : "!!document.querySelector('main')");
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

    await go("/admin/checkouts");
    await until("document.body.innerText.includes('CO-701')");
    cases.push("workspace-source-row");
    await choose('select[aria-label="Giai đoạn trả phòng"]', "INSPECTION");
    await until("document.body.innerText.includes('CO-701')");
    cases.push("stage-filter");
    await choose('select[aria-label="Tài chính trả phòng"]', "REFUND_PENDING");
    await sleep(300);
    cases.push("financial-filter");
    await click("Mở hồ sơ", "document.querySelector('tbody')");
    await until(
      "document.querySelector('dialog[open]')?.innerText.includes('Thông tin & lịch trả')",
    );
    cases.push("nine-step-dialog");
    for (const label of [
      "Hợp đồng & công nợ",
      "Kiểm kê tài sản",
      "Điện nước & dịch vụ",
      "Phí phát sinh",
      "Xem trước & phê duyệt",
      "Xác nhận & phản hồi",
      "Thu thiếu / hoàn cọc",
      "Bàn giao & đóng hồ sơ",
    ]) {
      await evaluate(
        "(()=>{const el=[...document.querySelectorAll('dialog[open] nav button')].find(e=>e.textContent.includes(" +
          js(label) +
          "));if(!el)throw Error('Missing wizard '+" +
          js(label) +
          ");el.click()})()",
      );
      await sleep(100);
    }
    cases.push("all-nine-steps-navigate");
    assert.ok(
      await evaluate(
        "document.querySelector('.checkout-print')?.textContent.includes('HD501')",
      ),
    );
    assert.ok(
      !(await evaluate(
        "document.querySelector('.checkout-print')?.textContent.includes('identity_number')",
      )),
    );
    cases.push("print-document-has-source-contract-without-identity-fields");
    await evaluate("document.body.dataset.checkoutPrint='true'");await command("Emulation.setEmulatedMedia",{media:"print"});assert.equal(await evaluate("getComputedStyle(document.querySelector('.checkout-print')).display"),"block");const pdf=await command("Page.printToPDF",{printBackground:true});assert.ok(Buffer.from(pdf.data,"base64").subarray(0,4).equals(Buffer.from("%PDF")));fs.mkdirSync("../docs/qa/checkouts-redesign",{recursive:true});fs.writeFileSync("../docs/qa/checkouts-redesign/fixture-print.pdf",Buffer.from(pdf.data,"base64"));await evaluate("delete document.body.dataset.checkoutPrint");await command("Emulation.setEmulatedMedia",{media:""});cases.push("browser-print-media-and-pdf-output");
    fs.mkdirSync("../docs/qa/checkouts-redesign", { recursive: true });
    const desktop = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/checkouts-redesign/desktop.png",
      Buffer.from(desktop.data, "base64"),
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(300);
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+2",
      ),
    );
    cases.push("mobile-no-page-overflow");
    fs.mkdirSync("../docs/qa/checkouts-redesign", { recursive: true });
    const shot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      "../docs/qa/checkouts-redesign/mobile.png",
      Buffer.from(shot.data, "base64"),
    );
    await go("/admin/checkouts");
    await until("document.body.innerText.includes('CO-701')");
    cases.push("reload-retains-source-record");
    mode = "error";
    await go("/admin/checkouts");
    await until("document.body.innerText.includes('Checkout read failed')");
    assert.ok(!(await evaluate("document.body.innerText.includes('CO-701')")));
    cases.push("read-error-hides-old-data");
    mode = "normal";
    role = "ACCOUNTANT";
    await go("/accountant/checkouts");
    await until("document.body.innerText.includes('CO-701')");
    assert.equal(await evaluate("document.querySelectorAll('aside').length"), 1);
    assert.ok(await evaluate(`!!document.querySelector('a[href="/accountant/checkouts"]')`));
    cases.push("accountant-route-one-shell-and-navigation");
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
