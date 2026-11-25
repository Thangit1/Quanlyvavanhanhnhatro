// Keep the bearer invitation secret in URL fragments, never login query strings or HTTP logs.
export function invitationRedirect(fragment: string): string | null {
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get(
    "invitation",
  );
  return token && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? `/accept-invitation#token=${token}`
    : null;
}
