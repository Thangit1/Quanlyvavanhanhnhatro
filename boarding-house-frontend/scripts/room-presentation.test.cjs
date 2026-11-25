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
      path.join(__dirname, "../src/lib/room-presentation.ts"),
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
  canStartRental,
  expiringInDays,
  previewRoomCodes,
  csvCell,
  roomsCsv,
  roomStatuses,
} = loaded.exports;
test("rental actions require vacancy without live contract, occupants or pending maintenance", () => {
  const room = {
    status: "VACANT",
    currentOccupants: 0,
    openMaintenanceCount: 0,
  };
  assert.equal(canStartRental(room), true);
  for (const status of [
    "RESERVED",
    "OCCUPIED",
    "NOTICE",
    "CLEANING",
    "MAINTENANCE",
    "INACTIVE",
  ])
    assert.equal(canStartRental({ ...room, status }), false);
  for (const patch of [
    { currentContract: { id: 1 } },
    { currentOccupants: 1 },
    { openMaintenanceCount: 1 },
  ])
    assert.equal(canStartRental({ ...room, ...patch }), false);
  assert.ok(
    roomStatuses.includes("NOTICE") && roomStatuses.includes("CLEANING"),
  );
});
test("contract warnings respect 30-day local calendar boundaries without editing room status", () => {
  const today = new Date(2026, 10, 17, 23, 30);
  assert.equal(expiringInDays("2026-11-17", today), 0);
  assert.equal(expiringInDays("2026-12-17", today), 30);
  assert.equal(expiringInDays("2026-12-18", today), null);
  assert.equal(expiringInDays("2026-11-16", today), null);
  assert.equal(expiringInDays(undefined, today), null);
});
test("bulk preview rejects fractional, excessive and overflowing ranges", () => {
  assert.deepEqual(previewRoomCodes("P", 101, 5), [
    "P101",
    "P102",
    "P103",
    "P104",
    "P105",
  ]);
  for (const args of [
    ["P", 1, 201],
    ["P", 1.5, 2],
    ["P", 999999, 2],
    ["=P", 101, 5],
    ["P", 1, 0],
  ])
    assert.deepEqual(previewRoomCodes(...args), []);
});
test("Excel-compatible CSV neutralizes formulas, quotes and embedded delimiters without exporting phone numbers", () => {
  for (const value of [
    "=1+1",
    " +SUM(A1:A2)",
    "-1+1",
    "@SUM(1)",
    "\t=1",
    "\r=1",
  ])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('A,"B"'), '"A,""B"""');
  const csv = roomsCsv(
    [
      {
        propertyName: "House",
        roomCode: "=DDE()",
        name: "Test",
        maxOccupants: 2,
        monthlyRent: 1000,
        status: "OCCUPIED",
        representativeTenant: {
          fullName: "Visible Name",
          phone: "PRIVATE_PHONE",
        },
        currentContract: { endDate: "2027-01-01" },
      },
    ],
    (s) => s,
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=DDE()"));
  assert.ok(!csv.includes("PRIVATE_PHONE"));
  assert.ok(csv.includes("2027-01-01"));
});
