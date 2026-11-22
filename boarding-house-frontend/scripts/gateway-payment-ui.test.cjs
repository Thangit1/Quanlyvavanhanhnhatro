/* eslint-disable @typescript-eslint/no-require-imports -- Component test harness. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function render(status, environment = "PRODUCTION", provider = "VNPAY") {
  const source = fs.readFileSync(
    "src/components/tenant/invoices/gateway-payment-panel.tsx",
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  let stateIndex = 0;
  const session = {
    id: 7,
    provider,
    environment,
    status,
    checkout_url: "https://sandbox.vnpayment.vn/test",
  };
  const mocks = {
    react: {
      ...React,
      useState: (initial) =>
        React.useState(stateIndex++ === 0 ? session : initial),
    },
    "@/hooks/use-scoped-query": {
      useScopedQuery: () => ({ data: [{ provider, environment }] }),
    },
    "@/services/api-client": { apiClient: {} },
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
    },
    "@/lib/api-error": { apiErrorMessage: () => "Provider error" },
  };
  const sandbox = { exports: {} };
  vm.runInNewContext(compiled, {
    module: sandbox,
    exports: sandbox.exports,
    require: (name) =>
      Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  });
  return renderToStaticMarkup(
    React.createElement(sandbox.exports.GatewayPaymentPanel, { invoiceId: 11 }),
  );
}

test("pending session exposes checkout while requiring verified server result", () => {
  const html = render("PENDING");
  assert.match(html, /href=/);
  assert.match(html, /không xác nhận đã thu tiền/);
});
test("failed session keeps debt warning and hides stale checkout", () => {
  const html = render("FAILED");
  assert.match(html, /Hóa đơn chưa được thanh toán/);
  assert.doesNotMatch(html, /href=/);
});
test("review state prevents initiating another payment", () => {
  const html = render("REVIEW_REQUIRED");
  assert.match(html, /disabled=""/);
  assert.match(html, /Vui lòng chưa thanh toán lại/);
  assert.doesNotMatch(html, /href=/);
});
test("sandbox success remains labelled and does not claim real payment", () => {
  const html = render("TEST_SUCCEEDED", "TEST");
  assert.match(html, /Sandbox thành công/);
  assert.match(html, /hóa đơn thật vẫn giữ công nợ/);
  assert.doesNotMatch(html, /href=/);
});

test("simulation controls are explicit and do not expose a real checkout link", () => {
  const html = render("PENDING", "TEST", "SIMULATED");
  assert.match(html, /Giả lập thành công/);
  assert.match(html, /Giả lập thất bại/);
  assert.match(html, /không thu tiền thật/);
  assert.doesNotMatch(html, /href=/);
});
test("expired attempts allow retry but never claim collected money", () => {
  const html = render("EXPIRED");
  assert.match(html, /hết hạn/);
  assert.match(html, /công nợ không tự thay đổi/);
  assert.doesNotMatch(html, /href=/);
});
