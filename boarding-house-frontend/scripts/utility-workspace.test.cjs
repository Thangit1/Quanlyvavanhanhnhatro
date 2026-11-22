/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
const loaded = { exports: {} };
new Function(
  "require",
  "exports",
  "module",
  ts.transpileModule(fs.readFileSync("src/lib/utility-workspace.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(require, loaded.exports, loaded);
const { readingEstimate: estimate } = loaded.exports;
test("missing previous is not silently zero", () => {
  for (const p of [null, undefined, "", "Thiếu kỳ trước"])
    assert.ok(estimate(p, "20", 3000).error);
});
test("negative, malformed and excessive decimal readings rejected", () => {
  for (const value of ["-1", "1.234", "NaN", "1e4", ""])
    assert.ok(estimate(0, value, 3000).error);
});
test("ordinary meter segment and estimate", () => {
  assert.deepEqual(estimate(1250, "1370", 3000), {
    consumption: 120,
    amount: 360000,
  });
});
test("zero is a real reading; missing input is not", () => {
  assert.equal(estimate(0, "0", 3000).consumption, 0);
  assert.ok(estimate(0, "", 3000).error);
});
test("decreasing ordinary segment requires replacement", () =>
  assert.ok(estimate(1250, "10", 3000).error));
test("multiple replacements add every valid segment", () => {
  assert.deepEqual(
    estimate(1250, "40", 3000, [
      { removed_reading: 1300, new_reading: 10 },
      { removed_reading: 50, new_reading: 20 },
    ]),
    { consumption: 110, amount: 330000 },
  );
});
test("incomplete replacement evidence blocks estimate", () => {
  assert.ok(
    estimate(1250, "40", 3000, [{ removed_reading: null, new_reading: 0 }])
      .error,
  );
});
test("missing price does not pretend amount is zero", () => {
  assert.equal(estimate(0, "10", null).amount, null);
});

test("draft reload validates data shape and captured version", () => {
  const valid = loaded.exports.validUtilityDrafts;
  assert.equal(valid(null), false);
  assert.equal(valid([]), false);
  assert.equal(valid({ 501: { version: 0 } }), false);
  assert.equal(
    valid({
      501: {
        version: 0,
        electricity: "1250",
        water: "250",
        reference: "PHOTO",
        reason: "Reviewed",
        confirmWarnings: true,
      },
    }),
    true,
  );
});
