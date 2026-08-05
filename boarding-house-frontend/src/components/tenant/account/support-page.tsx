"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Headphones, Mail, Phone, Send } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useAccountActions,
  useAccountSupport,
} from "@/hooks/use-tenant-account";
import { apiErrorMessage } from "@/lib/api-error";
import { AccountLoading, AccountPageLayout } from "./account-ui";
export function SupportPage() {
  const { user } = useAuth(),
    query = useAccountSupport(user?.activeRole === "TENANT"),
    actions = useAccountActions(),
    fileRef = useRef<HTMLInputElement>(null),
    [subject, setSubject] = useState(""),
    [content, setContent] = useState(""),
    [priority, setPriority] = useState("NORMAL"),
    [contact, setContact] = useState("EMAIL"),
    [file, setFile] = useState<File>(),
    [message, setMessage] = useState("");
  if (query.isLoading) return <AccountLoading />;
  const send = () =>
    actions.support.mutate(
      {
        subject,
        content,
        priority,
        preferredContact: contact,
        ...(file ? { file } : {}),
      },
      {
        onSuccess: () => {
          setSubject("");
          setContent("");
          setFile(undefined);
          if (fileRef.current) fileRef.current.value = "";
          setMessage("Yêu cầu hỗ trợ đã được gửi.");
        },
        onError: (e) => setMessage(apiErrorMessage(e)),
      },
    );
  return (
    <AccountPageLayout
      title="Hỗ trợ tài khoản"
      description="Liên hệ quản lý khi bạn cần trợ giúp về tài khoản."
    >
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"
        >
          {message}
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-3">
        <Info
          icon={Phone}
          title="Điện thoại"
          value={query.data?.phone || "Liên hệ quản lý khu trọ"}
        />
        <Info
          icon={Mail}
          title="Email"
          value={query.data?.email || "Liên hệ quản lý khu trọ"}
        />
        <Info
          icon={Headphones}
          title="Giờ hỗ trợ"
          value={query.data?.workingHours || "Theo thông tin khu trọ"}
        />
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Gửi yêu cầu hỗ trợ</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sửa chữa, hóa đơn và người ở cùng cần gửi tại đúng phân hệ để được xử
          lý nhanh hơn.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/tenant/maintenance/new"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold"
          >
            Yêu cầu sửa chữa
          </Link>
          <Link
            href="/tenant/invoices"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold"
          >
            Hóa đơn
          </Link>
          <Link
            href="/tenant/co-occupants/new"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold"
          >
            Người ở cùng
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold sm:col-span-2">
            Chủ đề
            <input
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Mức độ
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            >
              <option value="LOW">Thông thường</option>
              <option value="NORMAL">Cần hỗ trợ</option>
              <option value="HIGH">Quan trọng</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Phương thức liên hệ
            <select
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            >
              <option value="EMAIL">Email</option>
              <option value="PHONE">Điện thoại</option>
            </select>
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Nội dung
            <textarea
              value={content}
              maxLength={3000}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Tệp đính kèm
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="mt-1 block w-full rounded-xl border p-2 font-normal"
            />
          </label>
        </div>
        <button
          disabled={
            !subject.trim() || !content.trim() || actions.support.isPending
          }
          onClick={send}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-40"
        >
          <Send className="size-4" />
          {actions.support.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
      </section>
    </AccountPageLayout>
  );
}
function Info({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Phone;
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <Icon className="size-5 text-blue-600" />
      <h2 className="mt-2 font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{value}</p>
    </article>
  );
}
