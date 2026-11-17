/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../src/lib/api-error.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;
const loaded = { exports: {} };
new Function("require", "exports", "module", compiled)(
  require,
  loaded.exports,
  loaded,
);
const message = loaded.exports.contractCreationLoadError;
const failure = (status, text) => ({
  isAxiosError: true,
  response: { status, data: { message: text } },
});

test("old numeric contract route reports a version mismatch rather than a connection failure", () => {
  assert.match(message(failure(400, "Invalid contractId")), /cập nhật backend/);
});
test("missing creation API reports deployment/migration requirement", () => {
  assert.match(message(failure(404, "Not found")), /migration/);
});
test("permission failure preserves the server explanation", () => {
  assert.equal(
    message(failure(403, "Chưa được phân quyền nhà trọ")),
    "Chưa được phân quyền nhà trọ",
  );
});
test("backend offline is distinguished from a server response", () => {
  assert.match(message({ isAxiosError: true }), /Không thể kết nối backend/);
});
