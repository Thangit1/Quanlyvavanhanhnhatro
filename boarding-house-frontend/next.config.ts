import type { NextConfig } from "next";

// Separate audit builds/dev servers must not replace the user's running .next output.
const auditDist = process.env.NEXT_AUDIT_DIST_DIR;
if (auditDist && !/^\.next-audit[a-zA-Z0-9_-]*$/.test(auditDist)) {
  throw new Error(
    "NEXT_AUDIT_DIST_DIR must be a local .next-audit directory name",
  );
}
const nextConfig: NextConfig = {
  distDir: auditDist || ".next",
  ...(auditDist === ".next-audit-auth"
    ? {
        experimental: { cpus: 2, webpackMemoryOptimizations: true },
        typescript: { tsconfigPath: "tsconfig.auth.json" },
      }
    : {}),
  ...(auditDist === ".next-audit14-demo"
    ? { typescript: { tsconfigPath: "tsconfig.demo.json" } }
    : auditDist === ".next-audit15-integrations"
      ? { typescript: { tsconfigPath: "tsconfig.integrations.json" } }
      : {}),
};

export default nextConfig;
