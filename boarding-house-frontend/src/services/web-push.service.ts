import { apiClient, type ApiEnvelope } from "./api-client";
export type PushOption = { ownerId: number; publicKey: string; name: string };
export const pushOptions = async () =>
  (await apiClient.get<ApiEnvelope<PushOption[]>>("/push/options")).data.data;
const storage = "smarthome-push-subscriptions";
export async function enableWebPush(owner: PushOption) {
  if (
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw Error("Trình duyệt cần HTTPS hoặc localhost và hỗ trợ Web Push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Chưa được cấp quyền thông báo. Bạn có thể thay đổi trong cài đặt trình duyệt.",
    );
  await navigator.serviceWorker.register("/smarthome-push-sw.js", {
    scope: "/",
  });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription?.options.applicationServerKey) {
    const stored = new Uint8Array(subscription.options.applicationServerKey);
    const expected = atob(
      owner.publicKey.replace(/-/g, "+").replace(/_/g, "/"),
    );
    if (
      stored.length !== expected.length ||
      stored.some((value, index) => value !== expected.charCodeAt(index))
    ) {
      await disableWebPush();
      subscription = null;
    }
  }
  if (!subscription) {
    const raw = atob(owner.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
    const key = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
    const pendingSubscription = registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Some browsers leave subscribe pending when their push service is unreachable.
    // A late subscription after timeout must not remain enabled without server consent.
    void pendingSubscription
      .then(async (late) => {
        if (timedOut) await late.unsubscribe();
      })
      .catch(() => {});
    try {
      subscription = await Promise.race([
        pendingSubscription,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(
              Error(
                "Không kết nối được dịch vụ Push của trình duyệt trong 25 giây. Kiểm tra mạng rồi thử lại; thông báo trong ứng dụng vẫn hoạt động.",
              ),
            );
          }, 25000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const value = subscription.toJSON();
  const { data } = await apiClient.post<ApiEnvelope<{ id: number }>>(
    "/push/subscriptions",
    {
      ownerId: owner.ownerId,
      endpoint: value.endpoint,
      p256dh: value.keys?.p256dh,
      auth: value.keys?.auth,
    },
  );
  const ids: number[] = JSON.parse(localStorage.getItem(storage) || "[]");
  localStorage.setItem(
    storage,
    JSON.stringify(Array.from(new Set([...ids, data.data.id]))),
  );
}
export async function disableWebPush() {
  let ids: number[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(storage) || "[]");
  } catch {
    /* Recover corrupt browser state. */
  }
  try {
    await Promise.allSettled(
      ids
        .slice(0, 20)
        .filter(Number.isSafeInteger)
        .map((id) =>
          apiClient.delete(`/push/subscriptions/${id}`, { timeout: 3000 }),
        ),
    );
  } finally {
    localStorage.removeItem(storage);
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
    }
  }
}
