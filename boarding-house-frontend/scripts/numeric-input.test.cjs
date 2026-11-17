/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const loaded = { exports: {} };
new Function(
  "require",
  "exports",
  "module",
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/numeric-input.ts"),
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
const {
  numericText,
  normalizeNumericText,
  parseNumericValue,
  requiredNumericValue,
  parseNumericFields,
  parseVietnameseCurrencyPaste,
  formatVietnameseNumber,
  numericValidation,
} = loaded.exports;
test("empty, zero and absent values remain distinct until submission", () => {
  assert.equal(numericText(null), "");
  assert.equal(numericText(undefined), "");
  assert.equal(numericText(0), "0");
  assert.equal(parseNumericValue(""), undefined);
  assert.equal(parseNumericValue("0"), 0);
  assert.throws(() => requiredNumericValue(""));
});
test("completion removes only redundant zeroes and does not change the amount", () => {
  for (const [input, expected] of [
    ["0003500000", "3500000"],
    ["000", "0"],
    ["000.50", "0.5"],
    ["0.", "0"],
    ["1.", "1"],
    ["1.25", "1.25"],
    ["-0.00", "0"],
  ])
    assert.equal(normalizeNumericText(input), expected);
});
test("Vietnamese currency formatting never rounds decimal digits", () => {
  assert.equal(formatVietnameseNumber("3500000"), "3.500.000");
  assert.equal(
    formatVietnameseNumber("3500000.12345678"),
    "3.500.000,12345678",
  );
  assert.equal(formatVietnameseNumber("0.5"), "0,5");
});
test("currency paste supports raw numbers and Vietnamese grouping without multiplying decimals", () => {
  for (const [input, expected] of [
    ["3500000", "3500000"],
    ["3.500.000", "3500000"],
    ["3.500.000,50 đ", "3500000.50"],
    ["0.500", "0.500"],
    ["0,5", "0.5"],
    ["3500000.50", "3500000.50"],
  ])
    assert.equal(parseVietnameseCurrencyPaste(input), expected);
  assert.equal(parseVietnameseCurrencyPaste("hello"), undefined);
  assert.equal(parseVietnameseCurrencyPaste("3.50.000"), undefined);
});
test("invalid and nonfinite values never become API numbers", () => {
  for (const input of [
    NaN,
    Infinity,
    -Infinity,
    "NaN",
    "Infinity",
    "1e10",
    "1.2.3",
    "9007199254740992",
    "0.123456789012345678901",
  ])
    assert.throws(() => parseNumericValue(input));
});
test("integer, range, decimal step and required constraints stay independent", () => {
  assert.equal(
    numericValidation("", { required: true }),
    "Vui lòng nhập giá trị.",
  );
  assert.equal(numericValidation("", {}), "");
  assert.equal(numericValidation("0", { min: 0, step: "0.01" }), "");
  assert.notEqual(numericValidation("-1", { min: 0 }), "");
  assert.notEqual(numericValidation("101", { max: 100 }), "");
  assert.notEqual(numericValidation("0.5", { step: 1 }), "");
  assert.equal(numericValidation("0.5", { step: "0.01" }), "");
  assert.notEqual(numericValidation("0.001", { step: "0.01" }), "");
  assert.equal(numericValidation("0.12345678", { step: "any" }), "");
});
test("payload conversion is explicit and preserves phone, identity and service codes", () => {
  const draft = {
    amount: "0003500000",
    phone: "0900123456",
    identityNumber: "001234567890",
    roomCode: "001",
    discount: "",
    area: "",
    items: [{ code: "003", quantity: "2.5", unitPrice: "0" }],
  };
  const result = parseNumericFields(
    draft,
    ["amount", "discount", "area", "quantity", "unitPrice"],
    ["area"],
    { discount: 0 },
  );
  assert.deepEqual(result, {
    amount: 3500000,
    phone: "0900123456",
    identityNumber: "001234567890",
    roomCode: "001",
    discount: 0,
    area: undefined,
    items: [{ code: "003", quantity: 2.5, unitPrice: 0 }],
  });
  assert.equal(draft.amount, "0003500000");
  assert.deepEqual(parseNumericFields({ area: null }, ["area"], ["area"]), {
    area: null,
  });
});
test("saving and reopening normalized data preserves currency and meter precision", () => {
  const result = parseNumericFields(
    { rent: "3500000.25", reading: "1250.125" },
    ["rent", "reading"],
  );
  const reopened = JSON.parse(JSON.stringify(result));
  assert.equal(numericText(reopened.rent), "3500000.25");
  assert.equal(numericText(reopened.reading), "1250.125");
});
test("numeric fields use shared components instead of native number controls or eager coercion", () => {
  const failures = [];
  let fields = 0;
  function visitFolder(dir) {
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      const filename = path.join(dir, file.name);
      if (file.isDirectory()) visitFolder(filename);
      else if (filename.endsWith(".tsx")) {
        const source = fs.readFileSync(filename, "utf8"),
          sf = ts.createSourceFile(
            filename,
            source,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX,
          );
        function visit(n) {
          if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
            const tag = n.tagName.getText(sf),
              attrs = n.attributes.properties;
            const type = attrs
              .find(
                (a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "type",
              )
              ?.initializer?.getText(sf);
            if (type === '"number"') {
              fields++;
              if (tag === "input")
                failures.push(`${filename}: native number input`);
              const change =
                attrs
                  .find(
                    (a) =>
                      ts.isJsxAttribute(a) && a.name.getText(sf) === "onChange",
                  )
                  ?.getText(sf) || "";
              if (/Number\(|parseFloat\(|parseInt\(/.test(change))
                failures.push(`${filename}: eager numeric coercion`);
            }
          }
          ts.forEachChild(n, visit);
        }
        visit(sf);
      }
    }
  }
  visitFolder(path.join(__dirname, "../src"));
  assert.deepEqual(failures, []);
  assert.ok(fields > 60);
});
