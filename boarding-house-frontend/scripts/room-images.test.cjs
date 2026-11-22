/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
function service(api) {
  const loaded = { exports: {} };
  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/admin-property.service.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (name) =>
      name === "@/services/api-client" ? { apiClient: api } : require(name),
    loaded,
    loaded.exports,
  );
  return loaded.exports.adminPropertyService;
}
test("room create sends ordered multipart gallery, files, metadata and an idempotency key", async () => {
  let captured, progress;
  const client = service({
    post: async (...args) => {
      captured = args;
      return { data: { data: { id: 7 } } };
    },
  });
  const file = new File(["test"], "room.png", { type: "image/png" });
  const room = {
    propertyId: 1,
    buildingId: 0,
    floorId: 0,
    code: "ROOM",
    name: "Room",
    monthlyRent: 1200000,
    capacity: 2,
    description: "Keep this",
    amenityIds: [1],
    assets: [],
  };
  const gallery = { items: ["upload:0"], cover: 0 };
  await client.createRoom({
    ...room,
    gallery,
    imageFiles: [file],
    requestKey: "unit-test-request",
    onImageProgress: (p) => (progress = p),
  });
  const [url, body, options] = captured;
  assert.equal(url, "/admin/rooms");
  assert.ok(body instanceof FormData);
  const stored = JSON.parse(await body.get("room").text());
  assert.equal(stored.description, room.description);
  assert.equal(stored.monthlyRent, room.monthlyRent);
  assert.equal(stored.buildingId, undefined);
  assert.equal(stored.floorId, undefined);
  assert.equal(stored.gallery, undefined);
  assert.equal(stored.imageFiles, undefined);
  assert.equal(stored.requestKey, undefined);
  assert.deepEqual(JSON.parse(await body.get("gallery").text()), gallery);
  assert.equal(body.getAll("images").length, 1);
  assert.equal(body.get("images").name, file.name);
  assert.equal(options.headers["Idempotency-Key"], "unit-test-request");
  assert.equal(options.headers["Content-Type"], undefined);
  options.onUploadProgress({ loaded: 2, total: 4 });
  assert.equal(progress, 50);
});
test("reordering retained images and changing cover sends no new files", async () => {
  let captured;
  const client = service({
    put: async (...args) => {
      captured = args;
      return { data: { data: { room: { id: 8 } } } };
    },
  });
  const gallery = {
    items: [
      "/admin/properties/1/images/b.png",
      "/admin/properties/1/images/a.png",
    ],
    cover: 1,
  };
  await client.updateRoom(8, {
    propertyId: 1,
    code: "R",
    name: "Room",
    monthlyRent: 1,
    capacity: 1,
    amenityIds: [],
    assets: [],
    version: 3,
    gallery,
    imageFiles: [],
    requestKey: "update-test-key",
  });
  assert.equal(captured[0], "/admin/rooms/8");
  assert.deepEqual(
    JSON.parse(await captured[1].get("gallery").text()),
    gallery,
  );
  assert.equal(captured[1].getAll("images").length, 0);
  assert.equal(JSON.parse(await captured[1].get("room").text()).version, 3);
});
test("upload failure is propagated rather than reporting a room saved", async () => {
  const client = service({
    post: async () => {
      throw Error("storage unavailable");
    },
  });
  await assert.rejects(
    client.createRoom({
      gallery: { items: [], cover: 0 },
      imageFiles: [],
      requestKey: "failed-test-key",
    }),
    /storage unavailable/,
  );
});
