export const roles = ["OWNER", "MANAGER", "ACCOUNTANT", "TECHNICIAN", "TENANT"] as const;
export type Role = (typeof roles)[number];
export interface AuthUser { id: number; fullName: string; email: string; avatarUrl: string | null;
  availableRoles: Role[]; activeRole: Role; }
export interface LoginPayload { email: string; password: string; requestedRole: Role; }
export interface LoginData { accessToken: string; tokenType: "Bearer"; expiresIn: number; user: AuthUser; }
export interface RegisterPayload { fullName: string; email: string; phone?: string; password: string;
  confirmPassword: string; acceptedTerms: boolean; }
export interface RegisterData { id: number; fullName: string; email: string; role: "TENANT"; }
export const roleHome: Record<Role, string> = { OWNER: "/owner/dashboard", MANAGER: "/manager/dashboard",
  ACCOUNTANT: "/accountant/dashboard", TECHNICIAN: "/technician/tasks", TENANT: "/tenant/home" };
export const roleLabel: Record<Role, string> = { OWNER: "Chủ nhà", MANAGER: "Quản lý", ACCOUNTANT: "Kế toán",
  TECHNICIAN: "Kỹ thuật", TENANT: "Khách thuê" };
