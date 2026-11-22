import type { Metadata } from "next";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ManagementScopeProvider } from "@/providers/management-scope";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartHome AI",
  description: "Hệ thống quản lý và vận hành nhà trọ tích hợp AI",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <AuthProvider>
            <ManagementScopeProvider>{children}</ManagementScopeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
