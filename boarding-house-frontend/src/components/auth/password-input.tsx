"use client";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return <div className="relative">
      <input {...props} ref={ref} type={visible ? "text" : "password"}
        className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 pr-12 text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60" />
      <button type="button" disabled={props.disabled} onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-blue-700">
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>;
  },
);
