import { describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}));

const { getRequestOrigin } = await import("./request-origin");

function setHeaders(fields: Record<string, string>) {
  headerStore.clear();
  for (const [key, value] of Object.entries(fields)) {
    headerStore.set(key.toLowerCase(), value);
  }
}

describe("getRequestOrigin", () => {
  it("uses http for a plain localhost request (Mac dev server)", async () => {
    setHeaders({ host: "localhost:3000" });
    expect(await getRequestOrigin()).toBe("http://localhost:3000");
  });

  it("CRITICAL: uses http for a LAN IP request (phone on the same Wi-Fi) — this is the exact bug being fixed", async () => {
    setHeaders({ host: "192.168.0.11:3000" });
    expect(await getRequestOrigin()).toBe("http://192.168.0.11:3000");
  });

  it("works for a 10.x.x.x LAN range too", async () => {
    setHeaders({ host: "10.0.1.42:3000" });
    expect(await getRequestOrigin()).toBe("http://10.0.1.42:3000");
  });

  it("CRITICAL: uses http for a .local mDNS hostname — the actual mechanism used for phone-on-Wi-Fi auth redirects, since Supabase rejects raw LAN IP literals in its redirect allow-list", async () => {
    setHeaders({ host: "MacBook-Pro-de-Benjamin.local:3000" });
    expect(await getRequestOrigin()).toBe("http://MacBook-Pro-de-Benjamin.local:3000");
  });

  it("uses https and the forwarded host for a production/Vercel request", async () => {
    setHeaders({
      host: "redes-de-reino-git-main.vercel.app",
      "x-forwarded-host": "redes-de-reino.vercel.app",
      "x-forwarded-proto": "https",
    });
    expect(await getRequestOrigin()).toBe("https://redes-de-reino.vercel.app");
  });

  it("falls back to https for an unrecognized (public) hostname with no forwarded-proto header", async () => {
    setHeaders({ host: "redes-de-reino.vercel.app" });
    expect(await getRequestOrigin()).toBe("https://redes-de-reino.vercel.app");
  });
});
