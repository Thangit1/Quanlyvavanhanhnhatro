/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { webcrypto } = require("node:crypto");
global.crypto ??= webcrypto;
function load(file, resolve) {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const loaded = { exports: {} };
  new Function("require", "exports", "module", compiled)(
    resolve,
    loaded.exports,
    loaded,
  );
  return loaded.exports;
}
const rules = load("lib/contract-services.ts", require);
function tree(node) {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(tree);
  if (typeof node !== "object") return [];
  return [node, ...tree(node.props?.children)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
function harness({
  items = [],
  value = [],
  canOverride = true,
  canConfigure = true,
  scopeAccepted = true,
} = {}) {
  const state = [];
  let cursor = 0,
    editing = false,
    accepted = false;
  const query = {
    data: { items, canOverride, canConfigure },
    isPending: false,
    isError: false,
    isFetching: false,
  };
  const requireMock = (name) => {
    if (name === "react")
      return {
        ...React,
        useState(initial) {
          const index = cursor++;
          if (!(index in state))
            state[index] = typeof initial === "function" ? initial() : initial;
          return [
            state[index],
            (v) => {
              state[index] = typeof v === "function" ? v(state[index]) : v;
            },
          ];
        },
      };
    if (name === "@tanstack/react-query")
      return {
        useQuery: () => query,
        useQueryClient: () => ({ invalidateQueries: async () => {} }),
      };
    if (name === "@/providers/auth-provider")
      return {
        useAuth: () => ({
          user: { id: 1, activeRole: canConfigure ? "OWNER" : "MANAGER" },
        }),
      };
    if (name === "@/components/ui/button") return { Button: "button" };
    if (name === "@/lib/contract-services") return rules;
    if (name === "@/components/ui/number-input")
      return {
        CurrencyInput: "input",
        NumberInput: "input",
        DecimalInput: "input",
        IntegerInput: "input",
      };
    if (name === "@/lib/numeric-input")
      return load("lib/numeric-input.ts", require);
    if (name === "@/lib/format") return { formatCurrency: String };
    if (name === "@/lib/api-error")
      return { apiErrorMessage: (e) => e.message };
    if (name === "@/services/api-client")
      return {
        apiClient: {
          get: async () => assert.fail("query mocked"),
          post: async () => assert.fail("test must not write external data"),
          put: async () => assert.fail("test must not write external data"),
        },
      };
    return require(name);
  };
  const { ContractServicesEditor } = load(
    "components/admin/contracts/contract-services-editor.tsx",
    requireMock,
  );
  function render() {
    cursor = 0;
    return ContractServicesEditor({
      propertyId: 1,
      start: "2026-11-01",
      end: "2027-11-01",
      value,
      onChange: (next) => {
        value = next;
      },
      scopeAccepted,
      onAcceptScope: () => {
        accepted = true;
      },
      onEditingChange: (next) => {
        editing = next;
      },
    });
  }
  function button(label, root = render()) {
    const found = tree(root).find(
      (n) => n.type === "button" && text(n).trim() === label,
    );
    assert.ok(found, `button: ${label}`);
    return found;
  }
  function field(label, tag = "input") {
    const parent = tree(render()).find(
      (n) => n.type === "label" && text(n).startsWith(label),
    );
    assert.ok(parent, `label: ${label}`);
    const found = tree(parent).find((n) => n.type === tag);
    assert.ok(found);
    return found;
  }
  function change(label, value, tag) {
    field(label, tag).props.onChange({ target: { value } });
  }
  return {
    render,
    button,
    field,
    change,
    get value() {
      return value;
    },
    get editing() {
      return editing;
    },
    get accepted() {
      return accepted;
    },
  };
}
const catalog = (id, name) => ({
  id,
  code: `CODE${id}`,
  name,
  description: "Mô tả\nNhiều dòng",
  category: "UTILITY",
  calculation_method: "FIXED",
  unit_price: 50,
  unit: "phòng/tháng",
  quantity: 1,
  billing_cycle: "MONTHLY",
  status: "ACTIVE",
  is_default: true,
  allow_price_override: false,
  prorate: false,
  version: 0,
});
test("recommended catalogue services are opt-in and multiple selections remain independent", () => {
  const h = harness({ items: [catalog(1, "Wi-Fi"), catalog(2, "Thang máy")] });
  assert.equal(h.value.length, 0);
  for (const name of ["Wi-Fi", "Thang máy"])
    h.field(name).props.onChange({ target: { checked: true } });
  assert.equal(h.value.length, 2);
  assert.deepEqual(
    h.value.map((s) => s.catalogServiceId),
    [1, 2],
  );
  h.field("Wi-Fi").props.onChange({ target: { checked: false } });
  assert.equal(h.value[0].name, "Thang máy");
});
test("custom services can be added repeatedly with multiline Unicode and without losing earlier rows", async () => {
  const h = harness();
  for (const name of ["Dọn phòng riêng", "Nước uống", "Máy lạnh"]) {
    h.button("+ Thêm dịch vụ tùy chỉnh").props.onClick();
    assert.equal(h.editing, true);
    h.change("Tên dịch vụ", name);
    h.change("Mô tả chi tiết", "Tiếng Việt có dấu\nĐoạn thứ hai", "textarea");
    h.change("Ghi chú", "Ghi chú\nDòng hai", "textarea");
    h.change("Đơn giá (đ)", "20");
    await h.button("Lưu dịch vụ vào danh sách").props.onClick();
    assert.equal(h.editing, false);
  }
  assert.equal(h.value.length, 3);
  assert.equal(h.value[0].description, "Tiếng Việt có dấu\nĐoạn thứ hai");
  assert.equal(h.value[2].note, "Ghi chú\nDòng hai");
  h.button(
    "Sửa",
    tree(h.render()).find(
      (n) => n.type === "tr" && text(n).includes("Nước uống"),
    ),
  ).props.onClick();
  h.change("Đơn giá (đ)", "30");
  await h.button("Lưu dịch vụ vào danh sách").props.onClick();
  assert.deepEqual(
    h.value.map((s) => s.unitPrice),
    [20, 30, 20],
  );
  h.button(
    "Xóa",
    tree(h.render()).find(
      (n) => n.type === "tr" && text(n).includes("Dọn phòng riêng"),
    ),
  ).props.onClick();
  assert.equal(h.value.length, 2);
  assert.equal(h.value[0].name, "Nước uống");
});
test("invalid custom service remains open and preserves selected services", async () => {
  const h = harness({
    value: [
      {
        code: "KEEP",
        name: "Existing",
        calculationMethod: "FIXED",
        unitPrice: 10,
      },
    ],
  });
  h.button("+ Thêm dịch vụ tùy chỉnh").props.onClick();
  h.change("Tên dịch vụ", "New");
  h.change("Đơn giá (đ)", "-1");
  await h.button("Lưu dịch vụ vào danh sách").props.onClick();
  assert.equal(h.editing, true);
  assert.equal(h.value.length, 1);
  assert.ok(tree(h.render()).some((n) => n.props?.role === "alert"));
});
test("switching property requires review and does not silently delete a foreign service", () => {
  const h = harness({
    items: [catalog(1, "Wi-Fi")],
    scopeAccepted: false,
    value: [
      {
        code: "FOREIGN",
        name: "Old service",
        catalogServiceId: 99,
        calculationMethod: "FIXED",
        unitPrice: 10,
      },
    ],
  });
  h.button("Kiểm tra và áp dụng cho phòng này").props.onClick();
  assert.equal(h.accepted, false);
  assert.equal(h.value.length, 1);
  assert.ok(text(h.render()).includes("không thuộc bảng giá"));
});
test("manager without financial override cannot change catalogue prices or add custom charges", () => {
  const c = catalog(1, "Wi-Fi");
  const h = harness({
    items: [c],
    canOverride: false,
    canConfigure: false,
    value: [
      {
        code: c.code,
        name: c.name,
        catalogServiceId: c.id,
        calculationMethod: "FIXED",
        unitPrice: 50,
      },
    ],
  });
  assert.equal(h.button("+ Thêm dịch vụ tùy chỉnh").props.disabled, true);
  h.button("Sửa").props.onClick();
  assert.equal(h.field("Đơn giá (đ)").props.disabled, true);
  assert.equal(h.field("Phương pháp tính", "select").props.disabled, true);
});
test("Enter in descriptions keeps a newline while Enter in inputs cannot submit the contract", () => {
  const h = harness();
  const root = h.render();
  let prevented = false;
  root.props.onKeyDown({
    key: "Enter",
    target: { tagName: "TEXTAREA" },
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
  root.props.onKeyDown({
    key: "Enter",
    target: { tagName: "INPUT" },
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});
