"use client";
import type { OnboardingDetail } from "@/types/contract-onboarding";
import { formatCurrency, formatDate } from "@/lib/format";

const states: Record<string, string> = {
  COMPLETED: "Đã hoàn thành",
  PENDING: "Chưa hoàn thành",
  NEEDS_INFORMATION: "Cần bổ sung thông tin",
  WAITING_OTHER: "Đang chờ bên còn lại",
  NOT_APPLICABLE: "Không áp dụng theo chính sách hợp đồng",
};
const actions: Record<string, [string, string]> = {
  REVISE_CONTENT: ["Chốt lại nội dung hợp đồng", "contract-content"],
  CONFIRM_CONTENT: ["Đọc và xác nhận hợp đồng", "contract-content"],
  WAIT_OTHER_CONTENT: ["Chờ bên còn lại xác nhận hợp đồng", "contract-content"],
  UPDATE_PROFILE: ["Cập nhật hồ sơ", "identity-profile"],
  VERIFY_IDENTITY: ["Xác minh hồ sơ", "identity-profile"],
  RECORD_DEPOSIT: ["Ghi nhận tiền cọc", "deposit-ledger"],
  INITIAL_PAYMENT: ["Hoàn tất thanh toán đầu kỳ", "initial-finance"],
  PREPARE_HANDOVER: ["Lập biên bản bàn giao", "handover-editor"],
  CONFIRM_HANDOVER: ["Đối chiếu và xác nhận bàn giao", "handover-preview"],
  WAIT_DATE: ["Chờ đến ngày nhận phòng", "complete-checkin"],
  COMPLETE_CHECKIN: ["Hoàn tất nhận phòng", "complete-checkin"],
};
export function OnboardingProcedures({
  detail: d,
  contractId,
}: {
  detail: OnboardingDetail;
  contractId: number;
}) {
  const action = actions[d.nextAction ?? ""];
  const f = d.financialSummary;
  return (
    <>
      {d.procedureSteps && (
        <section className="space-y-3 rounded-xl border bg-muted p-4">
          <h3 className="font-semibold">Hoàn tất thủ tục thuê phòng</h3>
          <ol className="grid gap-3 md:grid-cols-2">
            {d.procedureSteps.map((s, i) => (
              <li
                key={s.key}
                className="rounded-xl border bg-card p-3 text-sm"
              >
                <p className="font-semibold">
                  {i + 1}. {s.label}
                </p>
                <p
                  className={
                    s.status === "COMPLETED"
                      ? "text-success"
                      : "text-warning"
                  }
                >
                  {states[s.status] ?? s.status}
                </p>
                <p className="mt-1 text-secondary-foreground">{s.description}</p>
                {s.completedAt && <p>{formatDate(s.completedAt, true)}</p>}
                {s.status !== "COMPLETED" && s.status !== "NOT_APPLICABLE" && (
                  <a
                    className="mt-2 inline-block text-link underline"
                    href={`#${s.anchor}`}
                  >
                    Xem và xử lý bước này
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {action && (
        <section
          className="rounded-xl border border-accent-border bg-accent p-4"
          aria-label="Việc cần thực hiện tiếp theo"
        >
          <h3 className="font-semibold">Việc cần thực hiện tiếp theo</h3>
          <a
            className="mt-2 inline-block font-semibold text-link underline"
            href={`#${action[1] === "deposit-ledger" ? `deposit-ledger-${contractId}` : action[1]}`}
          >
            {d.nextAction === "CONFIRM_HANDOVER" &&
            d.progress.ownParty === "LANDLORD"
              ? "Chờ người thuê xác nhận biên bản bàn giao"
              : action[0]}
          </a>
          <p className="mt-1 text-xs text-secondary-foreground">
            Mỗi bên thao tác theo quyền của mình. Chỉ hoàn tất check-in mới kích
            hoạt hợp đồng.
          </p>
        </section>
      )}
      {f && (
        <section
          id="initial-finance"
          className="space-y-3 rounded-xl border p-4 text-sm"
        >
          <h3 className="font-semibold">Tài chính đầu kỳ</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt>Tiền thuê kỳ đầu (dự kiến)</dt>
              <dd>
                {f.rentEstimate === null
                  ? "Cần đối soát"
                  : formatCurrency(Number(f.rentEstimate))}
              </dd>
            </div>
            <div>
              <dt>Dịch vụ định kỳ (dự kiến)</dt>
              <dd>
                {formatCurrency(
                  Number(d.serviceEstimate?.recurringEstimate ?? 0),
                )}
              </dd>
            </div>
            <div>
              <dt>Phí một lần (dự kiến)</dt>
              <dd>
                {formatCurrency(Number(d.serviceEstimate?.onceEstimate ?? 0))}
              </dd>
            </div>
            <div>
              <dt>Điện nước định mức (dự kiến)</dt>
              <dd>
                {formatCurrency(
                  Number(d.serviceEstimate?.fixedUtilitiesEstimate ?? 0),
                )}
              </dd>
            </div>
            <div>
              <dt>Tiền cọc phải thu</dt>
              <dd>{formatCurrency(Number(f.depositRequired))}</dd>
            </div>
            <div>
              <dt>Số dư cọc đã ghi nhận</dt>
              <dd>
                {f.depositCollected === null
                  ? "Chưa có sổ cọc"
                  : formatCurrency(Number(f.depositCollected))}
              </dd>
            </div>
          </dl>
          <p>
            {f.depositSatisfied
              ? "Sổ cọc đã đáp ứng điều kiện nhận phòng."
              : "Sổ cọc chưa đáp ứng điều kiện nhận phòng; kiểm tra số còn thiếu và đối soát."}
          </p>
          <p>
            {!f.initialPaymentRequired
              ? "Không yêu cầu thanh toán trước"
              : f.initialPolicySatisfied
                ? "Đã đáp ứng chính sách thanh toán đầu kỳ"
                : "Chưa đáp ứng chính sách thanh toán đầu kỳ"}
          </p>
          {f.recordedInvoices.length === 0 ? (
            <p>
              Chưa có hóa đơn đầu kỳ đã phát hành. Chưa có số thực thu theo hóa
              đơn để kết luận đã thanh toán.
            </p>
          ) : (
            <div className="space-y-2">
              <h4 className="font-semibold">Theo hóa đơn đã phát hành</h4>
              {f.recordedInvoices.map((i) => (
                <p key={String(i.id)}>
                  {String(i.code)} · Phải thu{" "}
                  {formatCurrency(Number(i.total_amount))} · Đã thanh toán{" "}
                  {formatCurrency(Number(i.paid_amount))} · Còn phải thu{" "}
                  {formatCurrency(Number(i.remaining_amount))}
                </p>
              ))}
              <details>
                <summary>Khoản phát sinh và chi tiết đã ghi nhận</summary>
                {f.recordedItems.map((i, index) => (
                  <p key={index}>
                    {String(i.name)} · {formatCurrency(Number(i.amount))}
                  </p>
                ))}
              </details>
            </div>
          )}
          <p className="text-xs text-secondary-foreground">
            Dự kiến chưa phân bổ ngày lẻ, lượt sử dụng hoặc chiết khấu trên hóa
            đơn. Không cộng tiền cọc vào doanh thu thuê và không coi chính sách
            miễn thanh toán trước là đã thu tiền.
          </p>
        </section>
      )}
    </>
  );
}
