/* Web Push only: no offline caching or API interception. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    /* Use safe generic content. */
  }
  event.waitUntil(
    self.registration.showNotification("SmartHome AI", {
      body: "Có cập nhật mới. Đăng nhập để xem chi tiết.",
      tag:
        typeof payload.tag === "string"
          ? payload.tag.slice(0, 64)
          : "smarthome-update",
      data: { url: typeof payload.url === "string" ? payload.url : "/login" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      let target = new URL("/login", self.location.origin);
      try {
        const candidate = new URL(
          event.notification.data?.url || "/login",
          self.location.origin,
        );
        if (
          candidate.origin === self.location.origin &&
          /^\/(?:admin|owner|manager|tenant|accountant|technician|login)(?:\/|$)/.test(
            candidate.pathname,
          )
        )
          target = candidate;
      } catch {
        /* Login fallback. */
      }
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const window of windows)
        if (new URL(window.url).origin === target.origin) {
          await window.navigate(target.href);
          return window.focus();
        }
      return self.clients.openWindow(target.href);
    })(),
  );
});
