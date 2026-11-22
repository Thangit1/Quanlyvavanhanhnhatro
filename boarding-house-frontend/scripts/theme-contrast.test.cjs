/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const css = fs.readFileSync(
  path.join(__dirname, "../src/app/theme.css"),
  "utf8",
);
function palette(selector) {
  const text =
    css.match(new RegExp(selector + "\\s*\\{([\\s\\S]*?)\\}"))?.[1] || "";
  return Object.fromEntries(
    [...text.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}
const light = palette(":root"),
  dark = { ...light, ...palette("\\.dark") };
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("light palette uses the stronger contrast revision requested by the user", () => {
  for (const [key, value] of Object.entries({
    background: "#e2eaf3",
    card: "#ffffff",
    border: "#c0cddd",
    primary: "#2563eb",
    "primary-hover": "#1d4ed8",
    accent: "#dbe8ff",
    foreground: "#0f172a",
    "muted-foreground": "#52637b",
    divider: "#ccd7e4",
  }))
    assert.equal(light[key], value);
});
for (const [name, p] of [
  ["light", light],
  ["dark", dark],
])
  test(name + " semantic text pairs meet AA without rounding up", () => {
    for (const [text, bg] of [
      ["foreground", "background"],
      ["card-foreground", "card"],
      ["muted-foreground", "card"],
      ["muted-foreground", "background"],
      ["page-secondary", "background"],
      ["primary-foreground", "primary"],
      ["primary-foreground", "primary-hover"],
      ["accent-foreground", "accent"],
      ["link", "card"],
      ["destructive", "danger-muted"],
      ["success", "success-muted"],
      ["warning", "warning-muted"],
    ])
      assert.ok(
        contrast(p[text], p[bg]) >= 4.5,
        `${name} ${text}/${bg}: ${contrast(p[text], p[bg])}`,
      );
    assert.ok(contrast(p.input, p.card) >= 3);
    assert.ok(contrast(p.ring, p.card) >= 3);
  });
test("dark mode separates page/card, retains solid primary legibility, and print uses paper surfaces", () => {
  assert.notEqual(dark.background, dark.card);
  assert.notEqual(dark.card, light.card);
  assert.match(css, /@media print/);
  assert.match(css, /--surface-shadow: none/);
  assert.ok(!css.includes("!important"));
  const globals = fs.readFileSync(
    path.join(__dirname, "../src/app/globals.css"),
    "utf8",
  );
  assert.ok(!globals.includes('html[data-theme="dark"]'));
  assert.match(globals, /@import "\.\/theme.css"/);
});
