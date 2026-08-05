import { Building2 } from "lucide-react";
export function Brand() {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "SmartHome AI";
  return (
    <div className="flex items-center justify-center gap-3 text-blue-700">
      <span className="grid size-11 place-items-center rounded-xl bg-blue-700 text-white shadow-lg shadow-blue-200">
        <Building2 aria-hidden="true" className="size-6" />
      </span>
      <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        {name}
      </span>
    </div>
  );
}
