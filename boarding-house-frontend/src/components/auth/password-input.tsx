"use client";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className="h-12 w-full rounded-xl border border-input bg-muted px-4 pr-12 text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition focus:border-blue-600 focus:bg-card focus:ring-4 focus:ring-ring disabled:opacity-60"
      />
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-link"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
});
