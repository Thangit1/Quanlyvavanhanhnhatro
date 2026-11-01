/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const axios = require("axios");
const { QueryClient } = require("@tanstack/react-query");
test("network loss is surfaced without refreshing or clearing a valid session", async () => {
  const h = harness();
  h.api.setAccessToken("valid-user");
  let refreshes = 0;
  h.refresh.defaults.adapter = async (config) => {
    refreshes++;
    return response(config, { data: { accessToken: "unexpected" } });
  };
  h.client.defaults.adapter = async (config) => {
    throw new axios.AxiosError("Network unavailable", "ERR_NETWORK", config);
  };
  await assert.rejects(
    h.client.get("/admin/properties"),
    (error) => error.code === "ERR_NETWORK",
  );
  assert.equal(refreshes, 0);
  assert.equal(h.api.getAccessToken(), "valid-user");
});
test("a timed out money mutation is not automatically retried or announced as successful", async () => {
  const h = harness();
  h.api.setAccessToken("valid-user");
  let requests = 0,
    successes = 0;
  h.window.addEventListener("business:changed", () => successes++);
  h.client.defaults.adapter = async (config) => {
    requests++;
    assert.equal(config.headers["Idempotency-Key"], "retained-attempt-key");
    throw new axios.AxiosError("Request timed out", "ECONNABORTED", config);
  };
  await assert.rejects(
    h.client.post(
      "/accountant/payments",
      { amount: 100 },
      { headers: { "Idempotency-Key": "retained-attempt-key" } },
    ),
    (error) => error.code === "ECONNABORTED",
  );
  assert.equal(requests, 1);
  assert.equal(successes, 0);
});
test("private requests wait for the bootstrap refresh already in flight", async () => {
  const h = harness();
  let release,
    requests = 0;
  h.refresh.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(response(config, { data: { accessToken: "restored-user" } }));
    });
  h.client.defaults.adapter = async (config) => {
    requests++;
    assert.equal(config.headers.Authorization, "Bearer restored-user");
    return response(config, { private: true });
  };
  const refresh = h.api.refreshAccessToken();
  await tick();
  const query = h.client.get("/admin/properties");
  await tick();
  assert.equal(requests, 0);
  release();
  await refresh;
  await query;
  assert.equal(requests, 1);
});
test("logout cancels waiting and newly mounted private requests", async () => {
  const h = harness();
  let release,
    requests = 0;
  h.refresh.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(response(config, { data: { accessToken: "old-user" } }));
    });
  h.client.defaults.adapter = async (config) => {
    requests++;
    return response(config, {});
  };
  const refresh = h.api.refreshAccessToken();
  const refreshRejected = assert.rejects(refresh, (e) => axios.isCancel(e));
  await tick();
  const query = h.client.get("/accountant/notifications");
  const queryRejected = assert.rejects(query, (e) => axios.isCancel(e));
  await tick();
  h.api.resetApiSession();
  release();
  await refreshRejected;
  await queryRejected;
  await assert.rejects(h.client.get("/accountant/notifications"), (e) =>
    axios.isCancel(e),
  );
  assert.equal(requests, 0);
});
function compile(file, requireOverride = require, extras = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module: compiledModule,
      exports: compiledModule.exports,
      require: requireOverride,
      AbortController,
      Event,
      window: new EventTarget(),
      ...extras,
    },
    { filename: file },
  );
  return compiledModule.exports;
}
function harness() {
  const instances = [];
  const shim = {
    ...axios,
    create: (...args) => {
      const result = axios.create(...args);
      instances.push(result);
      return result;
    },
  };
  shim.default = shim;
  shim.__esModule = true;
  const window = new EventTarget();
  const api = compile(
    "src/services/api-client.ts",
    (name) => (name === "axios" ? shim : require(name)),
    { window, process: { env: {} } },
  );
  return { api, client: instances[0], refresh: instances[1], window };
}
const response = (config, data = {}) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});
const reject = (config, status) =>
  Promise.reject(
    new axios.AxiosError(
      "Synthetic denial",
      "ERR_BAD_REQUEST",
      config,
      undefined,
      { ...response(config), status },
    ),
  );
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("refresh requests share one rotation", async () => {
  const h = harness();
  let count = 0,
    release;
  h.refresh.defaults.adapter = (config) => {
    count++;
    return new Promise((resolve) => {
      release = () =>
        resolve(response(config, { data: { accessToken: "fresh-session" } }));
    });
  };
  const one = h.api.refreshAccessToken(),
    two = h.api.refreshAccessToken();
  await tick();
  release();
  await Promise.all([one, two]);
  assert.equal(count, 1);
  assert.equal(h.api.getAccessToken(), "fresh-session");
});
test("late refresh cannot resurrect a previous user", async () => {
  const h = harness();
  let release;
  h.refresh.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(response(config, { data: { accessToken: "old-user" } }));
    });
  const pending = h.api.refreshAccessToken();
  const rejection = assert.rejects(pending, (e) => axios.isCancel(e));
  await tick();
  h.api.resetApiSession();
  h.api.setAccessToken("new-user");
  release();
  await rejection;
  assert.equal(h.api.getAccessToken(), "new-user");
});
test("late private response is discarded after logout", async () => {
  const h = harness();
  let release;
  h.api.setAccessToken("user-a");
  h.client.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () => resolve(response(config, { private: "USER-A-DATA" }));
    });
  const pending = h.client.get("/tenant/contracts");
  const rejection = assert.rejects(pending, (e) => axios.isCancel(e));
  await tick();
  h.api.resetApiSession();
  release();
  await rejection;
  assert.equal(h.api.getAccessToken(), null);
});
test("401 retries once after rotation with the new token", async () => {
  const h = harness();
  let requests = 0,
    rotations = 0;
  h.api.setAccessToken("expired");
  h.refresh.defaults.adapter = async (config) => {
    rotations++;
    return response(config, { data: { accessToken: "renewed" } });
  };
  h.client.defaults.adapter = async (config) => {
    requests++;
    if (requests === 1) return reject(config, 401);
    assert.equal(config.headers.Authorization, "Bearer renewed");
    return response(config, { ok: true });
  };
  await h.client.get("/tenant/invoices");
  assert.equal(rotations, 1);
  assert.equal(requests, 2);
});
test("403 does not rotate or retry credentials", async () => {
  const h = harness();
  let rotations = 0;
  h.refresh.defaults.adapter = async (config) => {
    rotations++;
    return response(config, { data: { accessToken: "wrong" } });
  };
  h.client.defaults.adapter = (config) => reject(config, 403);
  await assert.rejects(h.client.get("/owner/forbidden"));
  assert.equal(rotations, 0);
});
test("revoking a previously readable resource emits one cache purge", async () => {
  const h = harness();
  let purges = 0;
  h.window.addEventListener("access:revoked", () => purges++);
  h.client.defaults.adapter = async (config) =>
    response(config, { private: "synthetic" });
  await h.client.get("/admin/invoices/1");
  h.client.defaults.adapter = (config) => reject(config, 403);
  await assert.rejects(h.client.get("/admin/invoices/1"));
  await assert.rejects(h.client.get("/admin/invoices/1"));
  assert.equal(purges, 1);
});
test("only successful current mutations invalidate business data", async () => {
  const h = harness();
  let changes = 0;
  h.window.addEventListener("business:changed", () => changes++);
  h.client.defaults.adapter = async (config) => response(config, { ok: true });
  await h.client.post("/admin/payments", {});
  await h.client.get("/admin/payments");
  await h.client.post("/auth/logout");
  assert.equal(changes, 1);
});
test("session reset clears real query and mutation caches including delayed data", async () => {
  const { clearSessionCache } = compile("src/services/session-cache.ts");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["profile"], { private: "USER-A" });
  client.getMutationCache().build(client, { mutationFn: async () => "USER-A" });
  let finish;
  const pending = client
    .fetchQuery({
      queryKey: ["delayed"],
      queryFn: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    })
    .catch(() => undefined);
  await tick();
  clearSessionCache(client);
  finish({ private: "USER-A" });
  await pending;
  assert.equal(client.getQueryData(["profile"]), undefined);
  assert.equal(client.getQueryData(["delayed"]), undefined);
  assert.equal(client.getMutationCache().getAll().length, 0);
});
