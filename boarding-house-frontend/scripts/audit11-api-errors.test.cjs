/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  axios = require("axios");
const m = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      require("node:path").join(__dirname, "../src/lib/api-error.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText,
  { module: m, exports: m.exports, require },
);
const message = m.exports.apiErrorMessage;
const failure = (status, data, code) =>
  new axios.AxiosError(
    "Transport error",
    code,
    undefined,
    undefined,
    status ? { status, data } : undefined,
  );
test("missing endpoint and missing business record remain different", () => {
  assert.match(
    message(
      failure(404, {
        errorCode: "RESOURCE_NOT_FOUND",
        message: "Không tìm thấy tài nguyên được yêu cầu.",
      }),
    ),
    /phiên bản backend/,
  );
  assert.equal(
    message(
      failure(404, {
        errorCode: "INVOICE_NOT_FOUND",
        message: "Không tìm thấy hóa đơn.",
      }),
    ),
    "Không tìm thấy hóa đơn.",
  );
});
test("network, timeout, forbidden and server errors are distinguished", () => {
  assert.match(message(failure(null, null, "ERR_NETWORK")), /kết nối/);
  assert.match(message(failure(null, null, "ECONNABORTED")), /thời gian/);
  assert.match(message(failure(403, {})), /quyền/);
  assert.match(message(failure(500, {})), /Backend gặp lỗi/);
});
test("malformed upstream error bodies do not crash error rendering", () => {
  assert.doesNotThrow(() =>
    message(failure(500, { message: 123, errors: { detail: "unexpected" } })),
  );
  assert.doesNotThrow(() =>
    message(
      failure(400, {
        errors: [null, { message: 12 }, { message: "  Ngày không hợp lệ  " }],
      }),
    ),
  );
  assert.equal(
    message(failure(400, { errors: [{ message: "  Thiếu nhà trọ  " }] })),
    "Thiếu nhà trọ",
  );
});
