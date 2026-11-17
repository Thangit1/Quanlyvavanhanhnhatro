/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, customRequire = require) {
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const loaded = { exports: {} };
  new Function("require", "exports", "module", js)(
    customRequire,
    loaded.exports,
    loaded,
  );
  return loaded.exports;
}
const { isMissingCoOccupantResidence } = load("lib/co-occupant-error.ts");
const failure = (status, code) => ({
  isAxiosError: true,
  response: { status, data: { errorCode: code } },
});
test("missing residence is an empty business state", () => {
  assert.equal(
    isMissingCoOccupantResidence(failure(404, "CO_OCCUPANT_NOT_FOUND")),
    true,
  );
});
test("a missing endpoint is not interpreted as missing residence", () => {
  assert.equal(isMissingCoOccupantResidence(failure(404, "NOT_FOUND")), false);
});
test("permission and network failures are not hidden by the empty state", () => {
  assert.equal(
    isMissingCoOccupantResidence(failure(403, "CO_OCCUPANT_FORBIDDEN")),
    false,
  );
  assert.equal(isMissingCoOccupantResidence({ isAxiosError: true }), false);
});
test("empty state explains the missing room and provides working navigation", () => {
  const { NoCoOccupantResidence } = load(
    "components/tenant/co-occupants/co-occupant-empty-state.tsx",
    (name) =>
      name === "@/components/shared/contract-changes-panel"
        ? { RepresentativeInvitations: () => null }
        : require(name),
  );
  const html = require("react-dom/server").renderToStaticMarkup(
    require("react").createElement(NoCoOccupantResidence),
  );
  assert.match(html, /Chưa có phòng đang cư trú/);
  assert.match(html, /href="\/tenant\/contracts"/);
  assert.match(html, /href="\/tenant\/home"/);
  assert.doesNotMatch(html, /kiểm tra kết nối|Thử lại/);
});
