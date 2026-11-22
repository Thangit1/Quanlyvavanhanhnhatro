/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
function compile(file, api = {}) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, "../" + file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (name) =>
      name === "@/services/api-client" ? { apiClient: api } : require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}
test("image metadata preflight accepts JPG PNG WEBP and rejects unsupported, empty and oversized files", () => {
  const { imageFileError } = compile("src/components/shared/image-upload.tsx");
  for (const [name, type] of [
    ["a.jpg", "image/jpeg"],
    ["a.PNG", "image/png"],
    ["a.webp", "image/webp"],
  ])
    assert.equal(imageFileError({ name, type, size: 100 }), "");
  assert.match(
    imageFileError({ name: "a.png", type: "image/png", size: 5242881 }),
    /5MB/,
  );
  assert.ok(
    imageFileError({ name: "a.svg", type: "image/svg+xml", size: 100 }),
  );
  assert.ok(imageFileError({ name: "a.exe", type: "image/png", size: 100 }));
  assert.ok(imageFileError({ name: "a.png", type: "image/png", size: 0 }));
});
test("multipart save retains property metadata, file identity and progress without serializing UI callbacks", async () => {
  let captured;
  const { adminPropertyService } = compile(
    "src/services/admin-property.service.ts",
    {
      post: async (...args) => {
        captured = args;
        return { data: { data: { id: 7 } } };
      },
    },
  );
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  const payload = {
    code: "HOUSE",
    name: "House",
    type: "BOARDING_HOUSE",
    address: "Address",
    phone: "0911111111",
    email: "photo@test.invalid",
    operationStartDate: "2026-11-18",
    managerId: 2,
    version: 5,
    description: "Retain metadata",
    thumbnailUrl: "/admin/properties/7/images/old.png",
  };
  let percent;
  await adminPropertyService.create({
    ...payload,
    imageFile: file,
    onImageProgress: (v) => {
      percent = v;
    },
  });
  const [url, body, config] = captured;
  assert.equal(url, "/admin/properties");
  assert.ok(body instanceof FormData);
  assert.deepEqual(JSON.parse(await body.get("property").text()), payload);
  assert.equal(body.get("image").name, "photo.png");
  assert.equal(config.headers["Content-Type"], undefined);
  config.onUploadProgress({ loaded: 5, total: 10 });
  assert.equal(percent, 50);
});
test("removing an image submits an empty link and no file, and upload failure remains rejected", async () => {
  let body;
  const { adminPropertyService } = compile(
    "src/services/admin-property.service.ts",
    {
      put: async (_url, data) => {
        body = data;
        throw Error("storage unavailable");
      },
    },
  );
  await assert.rejects(
    adminPropertyService.update(7, {
      code: "HOUSE",
      name: "House",
      type: "BOARDING_HOUSE",
      address: "Address",
      thumbnailUrl: "",
      version: 5,
    }),
    /storage unavailable/,
  );
  assert.equal(body.get("image"), null);
  assert.equal(JSON.parse(await body.get("property").text()).thumbnailUrl, "");
});
