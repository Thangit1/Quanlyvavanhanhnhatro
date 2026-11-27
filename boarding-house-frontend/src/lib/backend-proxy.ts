/** Optional same-origin BFF. The upstream is server configuration, never user input. */
export async function proxyBackend(
  request: Request,
  path: string[],
): Promise<Response> {
  const failure = (status: number, errorCode: string, message: string) =>
    Response.json(
      { success: false, errorCode, message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  const configured = process.env.AUTH_PROXY_BACKEND_URL;
  if (!configured)
    return failure(
      503,
      "AUTH_PROXY_UNAVAILABLE",
      "Proxy đăng nhập chưa được cấu hình.",
    );
  let base: URL;
  try {
    base = new URL(configured);
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname.replace(/\/$/, "") !== "/api" ||
      !(
        base.protocol === "https:" ||
        (base.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
      )
    )
      throw new Error();
  } catch {
    return failure(
      503,
      "AUTH_PROXY_UNAVAILABLE",
      "Cấu hình backend proxy không hợp lệ.",
    );
  }
  if (
    !path.length ||
    path.some((segment) => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(segment))
  )
    return failure(400, "INVALID_PROXY_PATH", "Đường dẫn không hợp lệ.");
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const origin = request.headers.get("origin");
  if (
    unsafe &&
    (request.headers.get("X-Auth-Request") !== "1" ||
      (origin && origin !== new URL(request.url).origin))
  )
    return failure(
      403,
      "CSRF_REJECTED",
      "Yêu cầu không hợp lệ. Vui lòng tải lại trang.",
    );
  const target = new URL(base.href.replace(/\/$/, "") + "/" + path.join("/"));
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const key of [
    "authorization",
    "content-type",
    "accept",
    "idempotency-key",
    "x-auth-request",
    "origin",
    "user-agent",
  ])
    if (request.headers.has(key)) headers.set(key, request.headers.get(key)!);
  const cookieName = process.env.AUTH_PROXY_COOKIE_NAME || "refresh_token";
  if (!/^[A-Za-z0-9_-]+$/.test(cookieName))
    return failure(
      503,
      "AUTH_PROXY_UNAVAILABLE",
      "Tên cookie proxy không hợp lệ.",
    );
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(cookieName + "="));
  if (cookie) headers.set("cookie", cookie);
  // Do not forward arbitrary cookies, host, forwarding headers or Cloudflare client IP assertions.
  try {
    if (Number(request.headers.get("content-length")) > 60 * 1024 * 1024)
      return failure(
        413,
        "FILE_TOO_LARGE",
        "Nội dung vượt quá giới hạn proxy.",
      );
    const body = unsafe ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 60 * 1024 * 1024)
      return failure(
        413,
        "FILE_TOO_LARGE",
        "Nội dung vượt quá giới hạn proxy.",
      );
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    // Never follow an upstream redirect or forward credentials to another host.
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return failure(
        502,
        "BACKEND_REDIRECT_REJECTED",
        "Backend trả về chuyển hướng không hợp lệ.",
      );
    }
    const outgoing = new Headers({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    });
    for (const key of [
      "content-type",
      "content-disposition",
      "retry-after",
      "x-request-id",
    ])
      if (upstream.headers.has(key))
        outgoing.set(key, upstream.headers.get(key)!);
    for (const value of upstream.headers.getSetCookie()) {
      if (!value.startsWith(cookieName + "=")) continue;
      // Browser stores a host-only cookie on Vercel; preserve HttpOnly/Secure/SameSite/expiry.
      const rewritten = value
        .replace(/;\s*Domain=[^;]*/gi, "")
        .replace(/;\s*Path=[^;]*/gi, "; Path=/api/backend/auth");
      outgoing.append(
        "Set-Cookie",
        /;\s*Path=/i.test(rewritten)
          ? rewritten
          : rewritten + "; Path=/api/backend/auth",
      );
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    return failure(
      502,
      "BACKEND_UNREACHABLE",
      "Không thể kết nối từ proxy đến backend. Vui lòng thử lại sau.",
    );
  }
}
