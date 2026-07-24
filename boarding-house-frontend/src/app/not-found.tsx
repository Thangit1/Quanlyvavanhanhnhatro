import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
      <div className="space-y-4">
        <p className="text-6xl font-bold text-emerald-300">404</p>
        <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
        <Link className="text-emerald-300 underline" href="/">
          Quay về trang chủ
        </Link>
      </div>
    </main>
  );
}
