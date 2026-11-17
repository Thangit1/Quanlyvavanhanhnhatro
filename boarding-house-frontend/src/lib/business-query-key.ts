export function businessQueryKey(
  key: readonly unknown[],
  userId?: number,
  role?: string,
) {
  return [key[0], userId ?? null, role ?? null, ...key.slice(1)] as const;
}
