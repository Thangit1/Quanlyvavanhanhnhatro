import { LoginForm } from "@/components/auth/login-form";
export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_45%),linear-gradient(135deg,#f8fafc,#eff6ff)] px-4 py-8">
    <LoginForm />
  </main>;
}
