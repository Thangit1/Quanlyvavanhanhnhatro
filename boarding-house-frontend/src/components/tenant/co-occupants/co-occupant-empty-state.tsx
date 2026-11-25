"use client";
import Link from "next/link";
import { House } from "lucide-react";
import { RepresentativeInvitations } from "@/components/shared/contract-changes-panel";

export function NoCoOccupantResidence() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#e7eef8] p-4 pb-28 sm:p-6 lg:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <RepresentativeInvitations />
        <header>
          <p className="text-sm text-muted-foreground">Trang chủ / Người ở cùng</p>
          <h1 className="mt-1 text-3xl font-black text-foreground">
            Người ở cùng
          </h1>
          <p className="mt-1 text-secondary-foreground">
            Quản lý thông tin những người đang cư trú cùng phòng với bạn.
          </p>
        </header>
        <section className="rounded-3xl border border-accent-border bg-card px-6 py-12 text-center shadow-lg shadow-slate-300/40 sm:px-10">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-link">
            <House className="size-8" />
          </span>
          <h2 className="mt-5 text-xl font-extrabold text-foreground">
            Chưa có phòng đang cư trú
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-secondary-foreground">
            Tài khoản của bạn chưa được liên kết với phòng và hợp đồng thuê đang
            hiệu lực. Sau khi quản lý xác nhận thông tin cư trú, danh sách người
            ở cùng sẽ hiển thị tại đây.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/tenant/contracts"
              className="rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-bold text-white shadow-card hover:bg-primary-hover"
            >
              Kiểm tra hợp đồng
            </Link>
            <Link
              href="/tenant/home"
              className="rounded-xl border border-input bg-card px-5 py-3 font-bold text-secondary-foreground hover:bg-muted"
            >
              Về trang chủ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
