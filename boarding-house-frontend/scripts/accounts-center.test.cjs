/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, resolve = require) {
  const output = ts.transpileModule(
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
  new Function("require", "exports", "module", output)(
    resolve,
    result.exports,
    result,
  );
  return result.exports;
}
const { invitationRedirect } = load("lib/invitation-routing.ts");
test("invitation returns only to the fixed activation route and stays in a fragment", () => {
  const token = "a".repeat(43);
  assert.equal(
    invitationRedirect(`#invitation=${token}`),
    `/accept-invitation#token=${token}`,
  );
  assert.equal(
    invitationRedirect(
      `#invitation=${token}&redirect=https://attacker.invalid`,
    ),
    `/accept-invitation#token=${token}`,
  );
});
test("malformed, empty and external invitation destinations are rejected", () => {
  for (const fragment of [
    "",
    "#invitation=https://attacker.invalid",
    "#invitation=short",
    `#invitation=${"a".repeat(43)}%0A`,
    "#invitation=//attacker.invalid",
  ]) {
    assert.equal(invitationRedirect(fragment), null);
  }
});
let user = { id: 1, activeRole: "OWNER" };
let mode = "success";
let observed = [];
const tenant = {
  id: null,
  profile_id: 15,
  full_name: "Resident without account",
  email: "tenant@test.invalid",
  phone: "0900000001",
  status: "NO_ACCOUNT",
  role_code: "TENANT",
  tenant_code: "NT15",
  residence_status: "CHECKED_OUT",
  assignments: [
    { property_id: 8, property_name: "Property A", role_code: "TENANT" },
  ],
};
const page = {
  summary: { totalAccounts: 0, TENANT: 0, pending: 0, locked: 0 },
  items: [tenant],
  total: 1,
  page: 0,
  size: 20,
};
const { AccountsWorkspace } = load(
  "components/admin/accounts/accounts-page.tsx",
  function resolve(name) {
    if (name === "./account-ui")
      return load("components/admin/accounts/account-ui.tsx", resolve);
    if (name === "./create-account-wizard")
      return load(
        "components/admin/accounts/create-account-wizard.tsx",
        resolve,
      );
    if (name === "./manager-tenant-accounts")
      return load(
        "components/admin/accounts/manager-tenant-accounts.tsx",
        resolve,
      );
    if (name === "@/services/account-provisioning.service")
      return { accountProvisioningService: {} };
    if (name === "@/lib/phone-validation")
      return load("lib/phone-validation.ts");
    if (name === "@/providers/auth-provider")
      return { useAuth: () => ({ user }) };
    if (name === "@tanstack/react-query")
      return {
        useQueryClient: () => ({
          cancelQueries: async () => {},
          invalidateQueries: async () => {},
        }),
        useQuery: (options) => {
          observed.push(options);
          const isOptions =
            options.queryKey.includes("options") ||
            options.queryKey[0] === "account-provisioning-options";
          return {
            isPending: mode === "loading",
            isError: mode === "error",
            error: new Error("Connection unavailable"),
            data:
              mode === "success"
                ? isOptions
                  ? {
                      properties: [{ id: 8, name: "Property A" }],
                      areas: [],
                      staff: [],
                      managerAssignments: [],
                      tenantProfiles: [],
                      existingAccounts: [],
                      roles:
                        user.activeRole === "OWNER"
                          ? ["MANAGER", "TENANT", "ACCOUNTANT", "TECHNICIAN"]
                          : ["TENANT"],
                    }
                  : page
                : undefined,
            refetch: async () => {},
          };
        },
      };
    if (name === "@/services/owner-accounts.service")
      return {
        roleLabels: {
          MANAGER: "Người quản lý",
          TENANT: "Người thuê",
          ACCOUNTANT: "Kế toán",
          TECHNICIAN: "Kỹ thuật",
        },
        accountantPermissions: {},
        technicianPermissions: {},
        ownerAccountsService: {},
      };
    if (name === "@/components/shared/dashboard-ui")
      return {
        EmptyState: ({ text }) => React.createElement("p", null, text),
        ErrorState: ({ message }) =>
          React.createElement("p", { role: "alert" }, message),
        StatusBadge: ({ status }) => React.createElement("span", null, status),
      };
    if (name === "@/components/admin/admin-shell")
      return {
        AdminShell: ({ children }) =>
          React.createElement("div", null, children),
      };
    if (name === "@/lib/api-error")
      return { apiErrorMessage: (e) => e.message };
    if (name === "@/services/admin-tenant.service")
      return { adminTenantService: {} };
    if (name === "@/services/owner-access.service")
      return { managerCapabilities: {} };
    if (name === "next/link")
      return {
        default: ({ href, children, ...props }) =>
          React.createElement("a", { href, ...props }, children),
      };
    return require(name);
  },
);
function render() {
  observed = [];
  return renderToStaticMarkup(React.createElement(AccountsWorkspace));
}
test("owner sees unlinked tenant and keeps residence history independent of login status", () => {
  user = { id: 1, activeRole: "OWNER" };
  mode = "success";
  const html = render();
  assert.match(html, /Resident without account/);
  assert.match(html, /Đã trả phòng/);
  assert.match(html, /Chưa có tài khoản/);
  assert.match(html, /Tạo tài khoản/);
  assert.doesNotMatch(html, /Mời tài khoản/);
  assert.match(html, /href="\/admin\/tenants"/);
});
test("a manager cannot mount owner queries or receive staff controls", () => {
  user = { id: 2, activeRole: "MANAGER" };
  mode = "success";
  const html = render();
  assert.ok(
    observed
      .filter((q) => q.queryKey[0] === "owner-accounts")
      .every((q) => q.enabled === false),
  );
  assert.ok(
    observed.some(
      (q) =>
        q.queryKey[0] === "account-provisioning-options" && q.enabled === true,
    ),
  );
  assert.doesNotMatch(html, /Resident without account|Mời tài khoản/);
  assert.match(html, /Tạo tài khoản/);
  assert.match(html, /\/admin\/tenants/);
});
test("cached account queries are partitioned by identity and active role", () => {
  user = { id: 22, activeRole: "OWNER" };
  mode = "loading";
  render();
  assert.ok(
    observed.every(
      (q) => q.queryKey.includes(22) && q.queryKey.includes("OWNER"),
    ),
  );
  user = { id: 23, activeRole: "OWNER" };
  render();
  assert.ok(
    observed.every((q) => q.queryKey.includes(23) && !q.queryKey.includes(22)),
  );
});
test("loading and backend errors have explicit accessible states", () => {
  user = { id: 1, activeRole: "OWNER" };
  mode = "loading";
  assert.match(render(), /role="status"/);
  mode = "error";
  const html = render();
  assert.match(html, /role="alert"/);
  assert.match(html, /Connection unavailable/);
  mode = "success";
});
