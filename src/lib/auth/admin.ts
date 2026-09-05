/**
 * Optional lock: only these emails may register or sign in.
 * Set `VITE_ADMIN_EMAIL` (comma-separated if more than one). Empty = unlocked
 * (anyone can still register — local/dev default).
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.includes("@"));
}

export function emailIsAdmin(
  email: string | null | undefined,
  allowed: string[],
): boolean {
  if (allowed.length === 0) return true;
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

function envAdminEmail(): string | undefined {
  const fromVite = import.meta.env?.VITE_ADMIN_EMAIL;
  if (typeof fromVite === "string" && fromVite.trim()) return fromVite;
  if (typeof process !== "undefined") {
    const fromProcess = process.env.VITE_ADMIN_EMAIL ?? process.env.PULSE_ADMIN_EMAIL;
    if (fromProcess?.trim()) return fromProcess;
  }
  return undefined;
}

export function adminEmails(): string[] {
  return parseAdminEmails(envAdminEmail());
}

export function adminLockEnabled(): boolean {
  return adminEmails().length > 0;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return emailIsAdmin(email, adminEmails());
}
