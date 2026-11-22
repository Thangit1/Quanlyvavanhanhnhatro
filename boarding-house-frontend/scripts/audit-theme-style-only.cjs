/* eslint-disable @typescript-eslint/no-require-imports */
// Usage: node scripts/audit-theme-style-only.cjs <source-baseline-directory>
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  ts = require("typescript");
const baseline = process.argv[2];
if (!baseline) throw Error("Baseline directory required");
const root = path.resolve(__dirname, ".."),
  out = path.resolve(root, "../docs/qa/theme");
fs.mkdirSync(out, { recursive: true });
function walk(p) {
  return fs
    .readdirSync(p, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(p, e.name))
        : /\.tsx?$/.test(e.name)
          ? [path.join(p, e.name)]
          : [],
    );
}
function canonical(source, file) {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function node(n) {
    if (ts.isJsxAttribute(n) && n.name.getText(tree) === "className")
      return ["STYLE"];
    if (
      ts.isStringLiteralLike(n) ||
      n.kind === ts.SyntaxKind.TemplateHead ||
      n.kind === ts.SyntaxKind.TemplateMiddle ||
      n.kind === ts.SyntaxKind.TemplateTail
    ) {
      return [
        n.kind,
        /(?:^|\s|:)(?:bg-|text-|border|rounded|shadow|outline|focus|surface-card)/.test(
          n.text,
        )
          ? "STYLE"
          : n.text,
      ];
    }
    if (ts.isJsxText(n)) return [n.kind, n.text.trim().replace(/\s+/g, " ")];
    if (ts.isIdentifier(n) || ts.isNumericLiteral(n)) return [n.kind, n.text];
    const children = [];
    ts.forEachChild(n, (c) => {
      children.push(node(c));
    });
    return [n.kind, ...children];
  }
  return JSON.stringify(node(tree));
}
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex"),
  results = [];
for (const file of walk(path.join(root, "src"))) {
  const relative = path.relative(root, file),
    old = path.join(baseline, relative);
  if (!fs.existsSync(old)) continue;
  const a = fs.readFileSync(old, "utf8"),
    b = fs.readFileSync(file, "utf8");
  if (a.replaceAll("\r\n", "\n") === b.replaceAll("\r\n", "\n")) continue;
  const before = hash(canonical(a, file)),
    after = hash(canonical(b, file));
  results.push({
    file: relative.replaceAll("\\", "/"),
    nonStyleBefore: before,
    nonStyleAfter: after,
    unchanged: before === after,
  });
}
fs.writeFileSync(
  path.join(out, "style-only-audit.json"),
  JSON.stringify(
    {
      description:
        "AST comparison omitting className attributes and CSS utility string values; routing, handlers, API calls, form bindings and other data are compared.",
      files: results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    changedSourceFiles: results.length,
    nonStyleDifferences: results.filter((r) => !r.unchanged).map((r) => r.file),
  }),
);
if (results.some((r) => !r.unchanged)) process.exitCode = 1;
