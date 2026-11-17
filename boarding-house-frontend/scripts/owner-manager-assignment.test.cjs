/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  React = require("react");
const { QueryClient } = require("@tanstack/react-query");
function load(file, resolve = require) {
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const result = { exports: {} };
  new Function("require", "exports", "module", js)(
    resolve,
    result.exports,
    result,
  );
  return result.exports;
}
const { businessQueryKey } = load("lib/business-query-key.ts");
let user = { id: 1, activeRole: "OWNER" };
const queryMock = {
  useQuery: (options) => ({
    ...options,
    isPending: true,
    isLoading: options.enabled !== false,
  }),
  useMutation: (options) => options,
  useQueryClient: () => ({
    invalidateQueries: async () => {},
    cancelQueries: async () => {},
  }),
};
const scoped = load("hooks/use-scoped-query.ts", (name) =>
  name === "@tanstack/react-query"
    ? queryMock
    : name === "@/providers/auth-provider"
      ? { useAuth: () => ({ user }) }
      : name === "@/lib/business-query-key"
        ? { businessQueryKey }
        : require(name),
);
function hook(file) {
  return load(`hooks/${file}.ts`, (name) =>
    name === "./use-scoped-query"
      ? scoped
      : name === "@tanstack/react-query"
        ? queryMock
        : name.startsWith("@/services/")
          ? new Proxy(
              {},
              { get: () => new Proxy({}, { get: () => async () => ({}) }) },
            )
          : require(name),
  );
}
test("query cache separates actor, role, property and resource", async () => {
  const client = new QueryClient();
  const keys = [
    businessQueryKey(["admin-property", 10], 1, "OWNER"),
    businessQueryKey(["admin-property", 10], 2, "MANAGER"),
    businessQueryKey(["admin-property", 20], 1, "OWNER"),
    businessQueryKey(["admin-property", 10], 1, "MANAGER"),
  ];
  for (const [i, key] of keys.entries()) client.setQueryData(key, `data-${i}`);
  for (const [i, key] of keys.entries())
    assert.equal(client.getQueryData(key), `data-${i}`);
  await client.invalidateQueries({ queryKey: ["admin-property"] });
  assert.ok(keys.every((key) => client.getQueryState(key).isInvalidated));
  client.clear();
});
test("scoped reads stop when logged out and refetch after focus", () => {
  user = null;
  const disabled = scoped.useScopedQuery({
    queryKey: ["admin-properties", { propertyId: 10 }],
    queryFn: async () => [],
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.isLoading, true);
  user = { id: 2, activeRole: "MANAGER" };
  const enabled = scoped.useScopedQuery({
    queryKey: ["admin-properties", { propertyId: 10 }],
    queryFn: async () => [],
  });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.refetchInterval, 15000);
  assert.equal(enabled.refetchOnWindowFocus, "always");
  assert.deepEqual(enabled.queryKey, [
    "admin-properties",
    2,
    "MANAGER",
    { propertyId: 10 },
  ]);
});
test("detail hooks retain distinct IDs after adding the session scope", () => {
  user = { id: 1, activeRole: "OWNER" };
  const properties = hook("use-admin-properties"),
    tenants = hook("use-admin-tenants"),
    contracts = hook("use-admin-contracts"),
    invoices = hook("use-admin-invoices");
  for (const getter of [
    properties.useAdminProperty,
    properties.useAdminRoom,
    tenants.useAdminTenant,
    contracts.useAdminContract,
    invoices.useInvoiceDetail,
  ]) {
    const a = getter(10),
      b = getter(20);
    assert.equal(a.queryKey.at(-1), 10);
    assert.equal(b.queryKey.at(-1), 20);
    assert.notDeepEqual(a.queryKey, b.queryKey);
    assert.equal(a.queryKey[1], 1);
    assert.equal(a.queryKey[2], "OWNER");
  }
});
test("dashboard and report queries retain property filters within the session", () => {
  const dashboard = hook("use-dashboard"),
    reports = hook("use-admin-reports");
  user = { id: 2, activeRole: "MANAGER" };
  assert.deepEqual(dashboard.useAdminDashboard(true, 30, "MONTH").queryKey, [
    "admin-dashboard",
    2,
    "MANAGER",
    30,
    "MONTH",
  ]);
  assert.deepEqual(
    reports.useReportData("tenants", { propertyIds: [30] }).queryKey,
    ["report", 2, "MANAGER", "tenants", { propertyIds: [30] }],
  );
});
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const capabilities = {
  FINANCE_READ: "Read finance",
  FINANCE_WRITE: "Write finance",
  CONTRACT_APPROVE: "Approve contract",
  DEPOSIT_APPROVE: "Approve deposits",
  EXPORT: "Export",
};
function panel(role = "OWNER", available = true) {
  let cursor = 0;
  const state = [],
    writes = [];
  const data = {
    assignments: [],
    capabilities: [],
    availableManagers: available ? [{ id: 2, full_name: "Manager M" }] : [],
    properties: [
      { id: 10, name: "House A" },
      { id: 20, name: "House B" },
      { id: 30, name: "House C" },
    ],
  };
  const { PropertyManagersPanel } = load(
    "components/admin/properties/property-managers-panel.tsx",
    (name) => {
      if (name === "react")
        return {
          ...React,
          useState(initial) {
            const i = cursor++;
            if (!(i in state)) state[i] = initial;
            return [
              state[i],
              (next) => {
                state[i] = typeof next === "function" ? next(state[i]) : next;
              },
            ];
          },
        };
      if (name === "@/providers/auth-provider")
        return { useAuth: () => ({ user: { id: 1, activeRole: role } }) };
      if (name === "@tanstack/react-query")
        return {
          ...queryMock,
          useQuery: () => ({ data, isPending: false, isError: false }),
        };
      if (name === "@/services/owner-access.service")
        return {
          managerCapabilities: capabilities,
          ownerAccessService: {
            detail: async () => data,
            assign: async (p) => writes.push(p),
            revoke: async () => assert.fail("unexpected revoke"),
          },
        };
      if (name === "@/lib/api-error")
        return { apiErrorMessage: (e) => e.message };
      return require(name);
    },
  );
  const render = () => {
    cursor = 0;
    return PropertyManagersPanel({ propertyId: 10 });
  };
  return { render, writes };
}
test("owner chooses explicit properties and capabilities; nothing grants all houses automatically", async () => {
  const h = panel();
  global.window = { confirm: () => true };
  let tree = h.render();
  const select = nodes(tree).find((n) => n.type === "select");
  select.props.onChange({ target: { value: "2" } });
  tree = h.render();
  const house = nodes(tree).find(
    (n) => n.type === "label" && text(n) === "House B",
  );
  nodes(house)
    .find((n) => n.type === "input")
    .props.onChange({ target: { checked: true } });
  tree = h.render();
  const cap = nodes(tree).find(
    (n) => n.type === "label" && text(n) === "Approve contract",
  );
  nodes(cap)
    .find((n) => n.type === "input")
    .props.onChange({ target: { checked: true } });
  nodes(h.render())
    .find((n) => n.type === "textarea")
    .props.onChange({ target: { value: "Explicit delegation" } });
  nodes(h.render())
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(h.writes, [
    {
      propertyIds: [10, 20],
      userId: 2,
      capabilities: ["CONTRACT_APPROVE"],
      reason: "Explicit delegation",
    },
  ]);
  delete global.window;
});
test("manager has no owner assignment controls and missing manager guidance does not elevate public signup", () => {
  assert.equal(panel("MANAGER").render(), null);
  const content = text(panel("OWNER", false).render());
  assert.match(content, /Liên hệ quản trị hệ thống/);
  assert.match(content, /Đăng ký công khai hiện chỉ tạo tài khoản khách thuê/);
});
