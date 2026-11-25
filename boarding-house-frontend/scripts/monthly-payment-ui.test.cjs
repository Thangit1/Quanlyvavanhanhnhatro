/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness loads the transpiled client component. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function render({ status = "ISSUED", session = null, canPay = true } = {}) {
  const source = fs.readFileSync(
    "src/components/tenant/invoices/invoice-payment-page.tsx",
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const data = {
    invoiceCode: "HD-202610",
    status,
    remainingAmount: 4300000,
    permissions: { canPay },
    paymentMethods: [
      { code: "CASH", label: "Tiền mặt" },
      {
        code: "BANK_TRANSFER",
        label: "Chuyển khoản",
        bankName: "Test bank",
        accountNumber: "123",
        allowPartialPayment: true,
      },
    ],
  };
  const sandboxModule = { exports: {} };
  let stateIndex = 0;
  const mocks = {
    react: {
      ...React,
      useState: (initial) =>
        React.useState(stateIndex++ === 0 ? "BANK_TRANSFER" : initial),
    },
    "next/link": ({ children, ...props }) =>
      React.createElement("a", props, children),
    "@/providers/auth-provider": {
      useAuth: () => ({ user: { activeRole: "TENANT" } }),
    },
    "@/hooks/use-tenant-invoices": {
      useTenantInvoice: () => ({ data }),
      useActivePaymentSession: () => ({ data: session }),
      useInvoiceActions: () => ({ session: {}, proof: {} }),
    },
    "@/lib/api-error": { apiErrorMessage: () => "Error" },
    "@/components/shared/dashboard-ui": {
      ErrorState: () => null,
      PageLoading: () => null,
    },
    "./invoice-ui": { money: (value) => `${value} VND` },
    "./gateway-payment-panel": { GatewayPaymentPanel: () => null },
    "./vietqr-panel": { VietQrPanel: () => null },
  };
  vm.runInNewContext(compiled, {
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: (name) =>
      Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    Date,
    Intl,
    console,
  });
  return renderToStaticMarkup(
    React.createElement(sandboxModule.exports.InvoicePaymentPage, {
      invoiceId: 8,
    }),
  );
}

test("tenant cannot edit amount even if legacy policy allowed partial payments", () => {
  const html = render();
  assert.match(html, /4300000 VND/);
  assert.doesNotMatch(html, /type="number"/);
});
test("overdue invoice keeps payment choices and explains full balance", () => {
  const html = render({ status: "OVERDUE" });
  assert.match(html, /đã quá hạn/);
  assert.match(html, /Chọn phương thức/);
});
test("restored pending proof displays reconciliation and hides new payment and proof forms", () => {
  const html = render({
    session: {
      id: 30,
      amount: 4300000,
      paymentMethod: "BANK_TRANSFER",
      status: "PROOF_SUBMITTED",
      expiresAt: "2026-11-11T12:00:00",
    },
  });
  assert.match(html, /Đang chờ đối soát/);
  assert.match(html, /Kiểm tra lại trạng thái/);
  assert.doesNotMatch(html, /Chọn phương thức|type="file"/);
});
test("cash session has staff collection instructions without self confirmation", () => {
  const html = render({
    session: {
      id: 30,
      amount: 4300000,
      paymentMethod: "CASH",
      status: "AWAITING_TRANSFER",
      expiresAt: "2026-11-11T12:00:00",
    },
  });
  assert.match(html, /nhân viên xác nhận/);
  assert.doesNotMatch(html, /type="file"|Chọn phương thức/);
});
test("settled invoice cannot start another payment", () => {
  assert.doesNotMatch(
    render({ status: "PAID", canPay: false }),
    /Chọn phương thức|Tiếp tục/,
  );
});
