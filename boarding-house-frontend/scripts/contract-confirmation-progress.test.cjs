/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file) {
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
  const loaded = { exports: {} };
  new Function("require", "exports", "module", js)(
    (name) => {
      if (name === "@/types/contract-onboarding")
        return load("types/contract-onboarding.ts");
      if (name === "@/lib/contract-services")
        return load("lib/contract-services.ts");
      if (name === "@/lib/format")
        return { formatDate: String, formatCurrency: String };
      return require(name);
    },
    loaded.exports,
    loaded,
  );
  return loaded.exports;
}
const { ContractConfirmationProgress } = load(
  "components/shared/contract-confirmation-progress.tsx",
);
function render(overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(ContractConfirmationProgress, {
      busy: false,
      onConfirm: () => assert.fail("render must not confirm"),
      detail: {
        context: {
          code: "HD-TEST",
          tenant_name: "Tenant",
          property_name: "House",
          room_code: "101",
        },
        draft: {
          start_date: "2026-11-01",
          end_date: "2027-11-01",
          deposit_amount: 0,
          notice_period_days: 30,
        },
        monthlyRent: 1000,
        utilityRates: [],
        services: [],
        terms: [],
        contractVersion: {
          version: 2,
          content: "Full agreed contract content",
          content_hash: "a".repeat(64),
        },
        progress: {
          stage: "WAITING_TENANT",
          contentCurrent: true,
          tenant: { confirmed: false },
          landlord: { confirmed: false },
          checklist: [],
          completedCount: 0,
          canConfirm: true,
          ownParty: "TENANT",
          ...overrides,
        },
      },
    }),
  );
}
test("confirmation starts disabled until contract is opened and accepted", () => {
  const html = render();
  assert.match(html, /<details/);
  assert.match(html, /Full agreed contract content/);
  assert.match(html, /type="checkbox" disabled=""/);
  assert.match(html, /<button[^>]*disabled=""/);
});
test("bilateral confirmation still explains remaining checkin", () => {
  const html = render({
    bothConfirmed: true,
    stage: "WAITING_HANDOVER",
    ownConfirmed: true,
    confirmedByCurrentActor: true,
    canConfirm: false,
  });
  assert.match(html, /Hai bên đã xác nhận nội dung hợp đồng/);
  assert.match(html, /hoàn tất nhận phòng/);
  assert.match(html, /Bạn đã xác nhận hợp đồng cho phiên bản này/);
  assert.doesNotMatch(html, /type="checkbox"/);
});
test("owner sees the actual manager actor rather than being told they signed", () => {
  const html = render({
    ownConfirmed: true,
    confirmedByCurrentActor: false,
    canConfirm: false,
    landlord: {
      confirmed: true,
      actorName: "Manager Test",
      confirmedAt: "2026-11-02",
    },
  });
  assert.match(html, /Manager Test/);
  assert.match(html, /Bên cho thuê đã xác nhận phiên bản này/);
  assert.doesNotMatch(html, /Bạn đã xác nhận hợp đồng/);
});
test("stale content and read-only viewers cannot confirm", () => {
  const html = render({
    contentCurrent: false,
    canConfirm: false,
    stage: "CONTENT_REVIEW_REQUIRED",
  });
  assert.match(html, /Nội dung đã thay đổi/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, /<button/);
});
