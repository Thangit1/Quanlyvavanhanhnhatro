/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const http = require("node:http");
const axios = require("axios");
function load(file, env = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require,
    process: { env },
    Request,
    Response,
    Headers,
    URL,
    AbortSignal,
    fetch,
    console,
    Buffer,
    TextEncoder,
  });
  return exports;
}

test("HTTP business failures, anonymous 401 and network failures remain distinct", () => {
  const { authErrorMessage } = load("src/services/auth-error.ts");
  const error = (status, data) =>
    new axios.AxiosError(
      "failure",
      "ERR_BAD_RESPONSE",
      {},
      {},
      { status, data },
    );
  assert.equal(
    authErrorMessage(
      error(503, {
        errorCode: "PASSWORD_RECOVERY_UNAVAILABLE",
        message: "SMTP unavailable",
      }),
    ),
    "SMTP unavailable",
  );
  assert.doesNotMatch(
    authErrorMessage(error(401, { errorCode: "MISSING_REFRESH_TOKEN" })),
    /kết nối/,
  );
  assert.match(
    authErrorMessage(new axios.AxiosError("offline", "ERR_NETWORK")),
    /kết nối/,
  );
  assert.doesNotMatch(
    authErrorMessage(new axios.CanceledError("Session changed")),
    /kết nối/,
  );
  assert.match(
    authErrorMessage(error(400, { errorCode: "PASSWORD_RESET_TOKEN_INVALID" })),
    /hết hạn/,
  );
  assert.match(authErrorMessage(error(429, {})), /15 phút/);
});

test("same-origin proxy preserves cookies/rotation/deletion and forwards only allowed credentials", async (t) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/auth/login") {
      res.setHeader("Set-Cookie", [
        "refresh_token=first; Path=/api/auth; HttpOnly; Secure; SameSite=None",
        "unrelated=secret; Path=/",
      ]);
    } else if (req.url === "/api/auth/refresh") {
      if (req.headers.cookie !== "refresh_token=first") res.statusCode = 401;
      else
        res.setHeader(
          "Set-Cookie",
          "refresh_token=rotated; Domain=backend.test.invalid; Path=/api/auth; HttpOnly; Secure; SameSite=None",
        );
    } else if (req.url === "/api/auth/logout") {
      res.setHeader(
        "Set-Cookie",
        "refresh_token=; Max-Age=0; Path=/api/auth; HttpOnly; Secure; SameSite=None",
      );
    } else if (req.url === "/api/redirect") {
      res.statusCode = 302;
      res.setHeader("Location", "https://external.test.invalid");
    }
    res.end(JSON.stringify({ success: res.statusCode === 200 }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const { proxyBackend } = load("src/lib/backend-proxy.ts", {
    AUTH_PROXY_BACKEND_URL: `http://127.0.0.1:${server.address().port}/api`,
  });
  const request = (route, cookie) =>
    new Request("https://frontend.test.invalid/api/backend/" + route, {
      method: "POST",
      headers: {
        Origin: "https://frontend.test.invalid",
        "X-Auth-Request": "1",
        "Content-Type": "application/json",
        Cookie: cookie || "",
        Authorization: "Bearer access",
        "X-Forwarded-For": "spoofed",
        "CF-Connecting-IP": "spoofed",
      },
      body: "{}",
    });
  const login = await proxyBackend(request("auth/login"), ["auth", "login"]);
  assert.equal(login.status, 200);
  const cookies = login.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /Path=\/api\/backend\/auth/);
  assert.match(cookies[0], /HttpOnly; Secure; SameSite=None/);
  const refresh = await proxyBackend(
    request("auth/refresh", "other=private; refresh_token=first"),
    ["auth", "refresh"],
  );
  assert.equal(refresh.status, 200);
  assert.match(refresh.headers.getSetCookie()[0], /refresh_token=rotated/);
  assert.doesNotMatch(refresh.headers.getSetCookie()[0], /Domain=/);
  assert.equal(seen[1].headers.cookie, "refresh_token=first");
  assert.equal(seen[1].headers["cf-connecting-ip"], undefined);
  assert.equal(seen[1].headers["x-forwarded-for"], undefined);
  assert.equal(seen[1].headers.authorization, "Bearer access");
  const missing = await proxyBackend(request("auth/refresh"), [
    "auth",
    "refresh",
  ]);
  assert.equal(missing.status, 401); // Kept as HTTP auth failure, never converted to a connection failure.
  const logout = await proxyBackend(
    request("auth/logout", "refresh_token=rotated"),
    ["auth", "logout"],
  );
  assert.match(
    logout.headers.getSetCookie()[0],
    /Max-Age=0; Path=\/api\/backend\/auth/,
  );
  assert.equal(logout.headers.get("cache-control"), "no-store");
  assert.equal(
    (await proxyBackend(request("redirect"), ["redirect"])).status,
    502,
  );
  const before = seen.length;
  assert.equal(
    (
      await proxyBackend(
        new Request("https://frontend.test.invalid/api/backend/auth/logout", {
          method: "POST",
        }),
        ["auth", "logout"],
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await proxyBackend(
        new Request("https://frontend.test.invalid/api/backend/auth/logout", {
          method: "POST",
          headers: {
            Origin: "https://evil.test.invalid",
            "X-Auth-Request": "1",
          },
        }),
        ["auth", "logout"],
      )
    ).status,
    403,
  );
  assert.equal(
    (await proxyBackend(request("bad"), ["..", "auth"])).status,
    400,
  );
  assert.equal(seen.length, before);
});

test("proxy fails closed without a fixed trusted upstream", async () => {
  for (const url of [
    undefined,
    "https://backend.test.invalid/api?redirect=evil",
    "http://public.test.invalid/api",
  ]) {
    const { proxyBackend } = load("src/lib/backend-proxy.ts", {
      AUTH_PROXY_BACKEND_URL: url,
    });
    const response = await proxyBackend(
      new Request("https://frontend.test.invalid/api/backend/auth/me"),
      ["auth", "me"],
    );
    assert.equal(response.status, 503);
  }
});
