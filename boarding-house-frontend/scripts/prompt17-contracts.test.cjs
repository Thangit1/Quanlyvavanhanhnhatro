/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
function client(api) {
  const loaded = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/services/direct-contract.service.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", js)(
    () => ({ apiClient: api }),
    loaded,
    loaded.exports,
  );
  return loaded.exports.directContractService;
}
test("create-and-send preserves request and caller idempotency key on retry", async () => {
  const calls = [];
  const service = client({
    post: async (...args) => {
      calls.push(args);
      return { data: { data: { id: 9, status: "PENDING_CONFIRMATION" } } };
    },
  });
  const request = {
    roomId: 3,
    newTenant: {
      fullName: "Fixture",
      phone: "0917000017",
      email: "fixture@test.invalid",
    },
    terms: { monthlyRent: 1500000, depositAmount: 1000 },
    submit: true,
  };
  await service.save(request, "stable-request-key");
  await service.save(request, "stable-request-key");
  assert.equal(calls.length, 2);
  for (const [url, body, options] of calls) {
    assert.equal(url, "/admin/contracts");
    assert.deepEqual(body, request);
    assert.equal(options.headers["Idempotency-Key"], "stable-request-key");
  }
});
test("an agreement revision sends expected version and hash and cannot change tenant or room", async () => {
  let captured;
  const service = client({
    put: async (...args) => {
      captured = args;
      return { data: { data: null } };
    },
  });
  const terms = { monthlyRent: 1600000, depositAmount: 1000 };
  const result = await service.save(
    {
      roomId: 999,
      newTenant: { fullName: "Must not be forwarded" },
      terms,
      note: "Agreed revision",
      submit: true,
    },
    "revision-key",
    9,
    2,
    "a".repeat(64),
    true,
  );
  assert.equal(captured[0], "/admin/contract-onboarding/9/terms");
  assert.deepEqual(captured[1], {
    terms,
    reason: "Agreed revision",
    version: 2,
    contentHash: "a".repeat(64),
  });
  assert.equal(result.id, 9);
  assert.equal(result.status, "PENDING_CONFIRMATION");
});
test("an account provisioning failure is returned as a retained draft with continuation details", async () => {
  const result = {
    id: 9,
    status: "DRAFT",
    continuationCode: "ACCOUNT_PROVISIONING_CONFLICT",
    continuationMessage: "Email verification required",
  };
  const service = client({ post: async () => ({ data: { data: result } }) });
  assert.deepEqual(await service.submit(9), result);
});
test("transport failures remain rejected so the wizard cannot display a false successful send", async () => {
  const service = client({
    post: async () => {
      throw Error("network unavailable");
    },
  });
  await assert.rejects(
    service.save({ submit: true }, "retry-key"),
    /network unavailable/,
  );
});
