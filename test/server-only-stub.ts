// `server-only` throws when its module graph isn't split into server/client
// bundles the way Next.js's compiler does it. Vitest doesn't do that split,
// so tests alias the real package to this no-op stub.
export {};
