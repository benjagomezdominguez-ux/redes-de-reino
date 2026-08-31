// Guards the "return to where you were" redirect (rule 38) against open
// redirects: only a same-origin relative path is ever honored. Anything
// else (an absolute URL, a protocol-relative "//evil.com", a
// "javascript:" URI) falls back to the caller's default.
export function safeRedirectPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  return path;
}
