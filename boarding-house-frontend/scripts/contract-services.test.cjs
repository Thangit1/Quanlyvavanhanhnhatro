/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const loaded = { exports: {} };
new Function(
  "require",
  "exports",
  "module",
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/contract-services.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(require, loaded.exports, loaded);
const { serviceTotals, serviceSchema, normalizeService } = loaded.exports;
const row = (method, price, quantity = 1) =>
  normalizeService({
    code: method,
    name: method,
    calculationMethod: method,
    unitPrice: price,
    quantity,
    description: "Mô tả\nNhiều dòng",
    note: "Đoạn 1\nĐoạn 2",
  });
test("estimates separate recurring, usage, once and free services", () => {
  assert.deepEqual(
    serviceTotals([
      row("FIXED", 50),
      row("PER_PERSON", 10, 3),
      row("QUANTITY", 20, 2),
      row("USAGE", 99, 100),
      row("ONCE", 30, 2),
      row("FIXED", 0),
    ]),
    { recurring: 120, once: 60, usage: 1 },
  );
});
test("disabled and future services do not increase first-period estimate", () => {
  assert.deepEqual(
    serviceTotals(
      [
        { ...row("FIXED", 100), status: "INACTIVE" },
        { ...row("ONCE", 50), effectiveDate: "2026-12-01" },
        { ...row("FIXED", 100), endDate: "2026-11-01" },
      ],
      "2026-11-02",
    ),
    { recurring: 0, once: 0, usage: 0 },
  );
});
test("Unicode multiline descriptions and notes survive validation", () => {
  const item = row("QUANTITY", 0, 2);
  const result = serviceSchema.safeParse(item);
  assert.equal(result.success, true);
  assert.equal(result.data.description, item.description);
  assert.equal(result.data.note, item.note);
});
test("invalid amounts, quantities and oversized text are rejected", () => {
  for (const change of [
    { unitPrice: -1 },
    { unitPrice: 1.001 },
    { quantity: 0 },
    { quantity: 1.0001 },
    { description: "a".repeat(5001) },
    { note: "a".repeat(2001) },
  ])
    assert.equal(
      serviceSchema.safeParse({ ...row("QUANTITY", 50), ...change }).success,
      false,
    );
  assert.equal(serviceSchema.safeParse(row("FIXED", 50, 2)).success, false);
});
test("each item remains independent when editing or deleting another item", () => {
  const first = row("FIXED", 50),
    second = row("QUANTITY", 20, 2),
    third = row("ONCE", 10);
  const original = [first, second, third];
  const edited = original.map((s, i) =>
    i === 1 ? { ...s, unitPrice: 30 } : s,
  );
  assert.deepEqual(serviceTotals(edited.filter((s) => s !== third)), {
    recurring: 110,
    once: 0,
    usage: 0,
  });
  assert.equal(first.unitPrice, 50);
  assert.equal(second.unitPrice, 20);
});
