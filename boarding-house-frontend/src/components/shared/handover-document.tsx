"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import type {
  HandoverDocument,
  OnboardingDetail,
  OnboardingRow,
} from "@/types/contract-onboarding";

const conditions: Record<string, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Đã sử dụng",
  DAMAGED: "Hư hỏng",
  MISSING: "Thiếu",
  LOST: "Thiếu",
};
const statuses: Record<string, string> = {
  SUPERSEDED: "Phiên bản trước — chỉ xem lịch sử",
  CHANGED: "Cần kiểm tra và chốt phiên bản mới",
  BOTH_CONFIRMED: "Hai bên đã xác nhận",
  WAITING_CONFIRMATION: "Đang chờ xác nhận hai bên",
};
const value = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "Chưa lưu trong phiên bản này"
    : String(v);

export function HandoverDocumentView({
  document: d,
}: {
  document: HandoverDocument;
}) {
  const s = d.snapshot,
    g = s.general;
  return (
    <article className="handover-document space-y-5 rounded-xl border bg-white p-5 text-sm">
      <header className="border-b pb-4 text-center">
        <h3 className="text-xl font-bold">BIÊN BẢN BÀN GIAO PHÒNG TRỌ</h3>
        <p className="mt-2">
          {d.code} · Phiên bản {d.version}
        </p>
        <p>{statuses[d.status]}</p>
      </header>
      {!d.integrityValid && (
        <p role="alert" className="text-red-700">
          Không xác minh được tính toàn vẹn nội dung lưu. Chưa thể tiếp tục xác
          nhận phiên bản này.
        </p>
      )}
      <section>
        <h4 className="mb-2 font-semibold">
          1. Thông tin các bên và phòng bàn giao
        </h4>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            [
              "Mã hợp đồng",
              g.contractCode ??
                (g.contractId ? `Hợp đồng #${g.contractId}` : null),
            ],
            ["Nhà trọ", g.propertyName],
            ["Phòng", g.roomCode],
            ["Bên cho thuê", g.landlordName],
            ["Người thuê", g.tenantName],
            [
              "Ngày bàn giao",
              g.scheduledDate ? formatDate(String(g.scheduledDate)) : null,
            ],
            ["Thời điểm chốt", formatDate(d.createdAt, true)],
            ["Tình trạng phòng", g.roomCondition],
          ].map(([label, v]) => (
            <div key={String(label)}>
              <dt className="text-slate-500">{String(label)}</dt>
              <dd className="whitespace-pre-wrap font-medium">{value(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {Number(s.schemaVersion) < 2 && (
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
          Phiên bản cũ chỉ lưu một phần thông tin. Nội dung dưới đây được đọc từ
          bản đã lưu; không lấy thông tin hiện tại để điền thay dữ liệu lịch sử
          còn thiếu.
        </p>
      )}
      <section>
        <h4 className="mb-2 font-semibold">2. Chỉ số điện nước</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {[
                  "Loại",
                  "Phương pháp tính",
                  "Mã công tơ",
                  "Chỉ số bàn giao",
                  "Đơn vị",
                ].map((h) => (
                  <th className="border p-2" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["ELECTRICITY", "WATER"].map((type) => {
                const policy = s.utilities.find((u) => u.code === type),
                  meter = s.meters.find((m) => m.meter_type === type),
                  fixed = policy?.calculation_method === "FIXED";
                return (
                  <tr key={type}>
                    <td className="border p-2">
                      {type === "ELECTRICITY" ? "Điện" : "Nước"}
                    </td>
                    <td className="border p-2">
                      {fixed
                        ? "Phí cố định"
                        : policy?.calculation_method === "METER"
                          ? "Theo công tơ"
                          : "Chưa lưu chính sách trong bản cũ"}
                    </td>
                    <td className="border p-2">
                      {fixed
                        ? "Không yêu cầu công tơ"
                        : value(meter?.meter_code)}
                    </td>
                    <td className="border p-2">
                      {fixed ? "Không yêu cầu chỉ số" : value(s.readings[type])}
                    </td>
                    <td className="border p-2">
                      {fixed
                        ? "Theo hợp đồng"
                        : type === "ELECTRICITY"
                          ? "kWh"
                          : "m³"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">3. Tài sản bàn giao</h4>
        {!s.assets.length ? (
          <p>Không có tài sản được ghi trong phiên bản này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {[
                    "Tài sản",
                    "Số lượng",
                    "Tình trạng",
                    "Ghi chú / tham chiếu minh chứng",
                  ].map((h) => (
                    <th key={h} className="border p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.assets.map((a, i) => (
                  <tr key={String(a.room_asset_id ?? i)}>
                    <td className="border p-2">{value(a.asset_name)}</td>
                    <td className="border p-2">{value(a.quantity)}</td>
                    <td className="border p-2">
                      {conditions[String(a.condition_status)] ??
                        "Cần đối chiếu tình trạng đã ghi"}
                    </td>
                    <td className="whitespace-pre-wrap border p-2">
                      {a.note ? String(a.note) : "Không có ghi chú"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section>
        <h4 className="mb-2 font-semibold">4. Chìa khóa, thẻ và minh chứng</h4>
        <p>
          Tổng số chìa khóa / thẻ: <strong>{value(s.keysCardsCount)}</strong>
        </p>
        <p className="text-slate-500">
          Phiên bản này lưu tổng số, chưa tách số chìa khóa và số thẻ riêng.
        </p>
        <p>Tham chiếu biên bản: {value(g.reference)}</p>
        <p className="whitespace-pre-wrap">
          Ghi chú bàn giao:{" "}
          {g.note ? String(g.note) : "Không có ghi chú bổ sung"}
        </p>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">5. Xác nhận của hai bên</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {["LANDLORD", "TENANT"].map((party) => {
            const c = d.confirmations.find((c) => c.party === party);
            return (
              <div key={party} className="rounded-xl border p-4">
                <h5 className="font-bold">
                  {party === "LANDLORD" ? "BÊN CHO THUÊ" : "NGƯỜI THUÊ"}
                </h5>
                <p>
                  {c
                    ? "Đã xác nhận phiên bản này"
                    : "Chưa xác nhận phiên bản này"}
                </p>
                <p>Phiên bản: {d.version}</p>
                {c && (
                  <>
                    <p>Người xác nhận: {value(c.actor_name)}</p>
                    <p>Thời gian: {formatDate(String(c.confirmed_at), true)}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <p className="border-t pt-3 text-xs text-slate-600">
        Xác nhận nội bộ theo nội dung và phiên bản được lưu; không mặc nhiên là
        chữ ký điện tử được chứng thực. Xác nhận của phiên bản khác không thay
        thế xác nhận cho phiên bản này.
      </p>
    </article>
  );
}

export function HandoverDocumentPanel({
  detail: d,
  portal,
  contractId,
  busy,
  onConfirm,
}: {
  detail: OnboardingDetail;
  portal: "admin" | "tenant" | "accountant";
  contractId: number;
  busy: boolean;
  onConfirm: (request: { version: number; contentHash: string }) => void;
}) {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [reviewedHash, setReviewedHash] = useState("");
  const printable = useRef<HTMLDivElement>(null);
  const base = `/${portal}/contract-onboarding/${contractId}`;
  const history = useQuery({
    queryKey: ["handover-history", user?.id, user?.activeRole, contractId],
    enabled: !!user && historyOpen,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<OnboardingRow[]>>(
          `${base}/handover-versions`,
          { signal },
        )
      ).data.data,
    refetchInterval: 15_000,
  });
  const chosen = useQuery({
    queryKey: [
      "handover-document",
      user?.id,
      user?.activeRole,
      contractId,
      selected,
    ],
    enabled: !!user && selected !== null,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<HandoverDocument>>(
          `${base}/handover-versions/${selected}`,
          { signal },
        )
      ).data.data,
    refetchInterval: 15_000,
  });
  const document = selected === null ? d.handoverDocument : chosen.data;
  const own = d.progress.ownParty,
    ownConfirmed = !!document?.confirmations.some((c) => c.party === own),
    opposite = !!document?.confirmations.some(
      (c) => c.party !== own && Number(c.actor_id) === user?.id,
    );
  const canConfirm =
    !!document &&
    document.current &&
    document.integrityValid &&
    document.latest &&
    !!own &&
    !ownConfirmed &&
    !opposite &&
    d.checkin?.status === "READY" &&
    d.draft.status === "PENDING_CONFIRMATION";
  function printDocument() {
    if (!printable.current) return;
    const frame = window.document.createElement("iframe");
    frame.title = "In biên bản bàn giao đã chọn";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    window.document.body.append(frame);
    const target = frame.contentDocument;
    if (!target) {
      frame.remove();
      return;
    }
    target.title = document?.code ?? "Biên bản bàn giao";
    const style = target.createElement("style");
    style.textContent =
      "@page{size:A4;margin:18mm}body{font:14px Arial,sans-serif;color:#111}h3{text-align:center}section{margin:20px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:8px;text-align:left}dt{font-weight:bold;margin-top:8px}dd{margin:4px 0;white-space:pre-wrap}tr{break-inside:avoid}p{white-space:pre-wrap}";
    target.head.append(style);
    target.body.append(printable.current.cloneNode(true));
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }
  return (
    <section
      id="handover-preview"
      className="scroll-mt-6 space-y-4 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Biên bản bàn giao</h3>
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="text-sm text-blue-700 underline"
        >
          Xem lịch sử phiên bản
        </button>
      </div>
      {historyOpen && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <button
            type="button"
            className="text-blue-700 underline"
            onClick={() => {
              setSelected(null);
              setReviewedHash("");
            }}
          >
            Xem phiên bản mới nhất
          </button>
          {history.isPending ? (
            <p>Đang tải lịch sử…</p>
          ) : history.isError ? (
            <p role="alert">{apiErrorMessage(history.error)}</p>
          ) : (
            history.data?.map((v) => (
              <button
                type="button"
                key={String(v.id)}
                className="block text-sm text-blue-700 underline"
                onClick={() => {
                  setSelected(Number(v.version));
                  setReviewedHash("");
                }}
              >
                Phiên bản {String(v.version)} ·{" "}
                {formatDate(String(v.created_at), true)} ·{" "}
                {String(v.actor_name)}
              </button>
            ))
          )}
        </div>
      )}
      {selected !== null && chosen.isPending ? (
        <p>Đang tải phiên bản đã chọn…</p>
      ) : selected !== null && chosen.isError ? (
        <p role="alert">{apiErrorMessage(chosen.error)}</p>
      ) : document ? (
        <>
          {document.latest && !document.current && (
            <div
              role="alert"
              className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
            >
              <p>
                Thông tin bàn giao đã thay đổi so với phiên bản{" "}
                {document.version}. Vui lòng kiểm tra các thay đổi và lập phiên
                bản mới trước khi tiếp tục xác nhận.
              </p>
              <details>
                <summary className="cursor-pointer font-semibold">
                  Xem thay đổi
                </summary>
                <ul className="mt-2 list-disc pl-5">
                  {document.changes.map((c, i) => (
                    <li key={`${c.key}-${i}`}>{c.label}</li>
                  ))}
                </ul>
              </details>
              {d.progress.canManageHandover && (
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#handover-editor"
                    className="font-semibold text-blue-700 underline"
                  >
                    Cập nhật biên bản
                  </a>
                  <a
                    href="#handover-editor"
                    className="font-semibold text-blue-700 underline"
                  >
                    Kiểm tra và chốt phiên bản mới
                  </a>
                </div>
              )}
            </div>
          )}
          <div ref={printable}>
            <HandoverDocumentView document={document} />
          </div>
          {Number(document.snapshot.schemaVersion) < 2 &&
            d.progress.canManageHandover && (
              <a
                href="#handover-editor"
                className="block text-sm font-semibold text-blue-700 underline"
              >
                Kiểm tra thực tế và chốt phiên bản đầy đủ thông tin
              </a>
            )}
          <button
            type="button"
            disabled={!document.integrityValid}
            onClick={printDocument}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            In / lưu PDF phiên bản {document.version}
          </button>
          {canConfirm && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    reviewedHash ===
                    `${document.id}:${document.version}:${document.contentHash}:${document.liveHash}`
                  }
                  onChange={(e) =>
                    setReviewedHash(
                      e.target.checked
                        ? `${document.id}:${document.version}:${document.contentHash}:${document.liveHash}`
                        : "",
                    )
                  }
                />
                Tôi đã xem biên bản trên, đối chiếu tài sản, công tơ, chỉ số và
                chìa khóa/thẻ với thực tế và đồng ý xác nhận phiên bản{" "}
                {document.version}.
              </label>
              <button
                type="button"
                disabled={
                  busy ||
                  reviewedHash !==
                    `${document.id}:${document.version}:${document.contentHash}:${document.liveHash}`
                }
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40"
                onClick={() => {
                  if (
                    window.confirm(
                      `Xác nhận ${own === "TENANT" ? "bên thuê" : "bên cho thuê"} đã đối chiếu và đồng ý biên bản phiên bản ${document.version}?`,
                    )
                  )
                    onConfirm({
                      version: Number(document.version),
                      contentHash: document.contentHash,
                    });
                }}
              >
                Xác nhận biên bản{" "}
                {own === "TENANT" ? "người thuê" : "bên cho thuê"}
              </button>
            </div>
          )}
        </>
      ) : (
        <p>
          Chưa có phiên bản biên bản được chốt. Bên cho thuê cần kiểm kê và lập
          biên bản trước.
        </p>
      )}
    </section>
  );
}
