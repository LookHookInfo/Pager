/**
 * Single source for the public site URL and address shortening.
 */

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://pager.lookhook.info").replace(/\/+$/, "");
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "?";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
