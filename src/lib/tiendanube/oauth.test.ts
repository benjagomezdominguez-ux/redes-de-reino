import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken } from "./oauth";

describe("buildAuthorizeUrl", () => {
  const originalClientId = process.env.TIENDANUBE_CLIENT_ID;

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.TIENDANUBE_CLIENT_ID;
    else process.env.TIENDANUBE_CLIENT_ID = originalClientId;
  });

  it("returns null when TIENDANUBE_CLIENT_ID isn't configured — never invents a client id", () => {
    delete process.env.TIENDANUBE_CLIENT_ID;
    expect(buildAuthorizeUrl("some-state")).toBeNull();
  });

  it("builds the exact official authorize URL with the state param", () => {
    process.env.TIENDANUBE_CLIENT_ID = "40899";
    expect(buildAuthorizeUrl("abc123")).toBe("https://www.tiendanube.com/apps/40899/authorize?state=abc123");
  });

  it("URL-encodes the state value", () => {
    process.env.TIENDANUBE_CLIENT_ID = "40899";
    expect(buildAuthorizeUrl("a b&c")).toBe("https://www.tiendanube.com/apps/40899/authorize?state=a%20b%26c");
  });
});

describe("exchangeCodeForToken", () => {
  const originalId = process.env.TIENDANUBE_CLIENT_ID;
  const originalSecret = process.env.TIENDANUBE_CLIENT_SECRET;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.TIENDANUBE_CLIENT_ID = "40899";
    process.env.TIENDANUBE_CLIENT_SECRET = "test-secret";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (originalId === undefined) delete process.env.TIENDANUBE_CLIENT_ID;
    else process.env.TIENDANUBE_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.TIENDANUBE_CLIENT_SECRET;
    else process.env.TIENDANUBE_CLIENT_SECRET = originalSecret;
    vi.unstubAllGlobals();
  });

  it("CRITICAL: refuses to call Tiendanube at all if client id/secret aren't configured — never invents credentials", async () => {
    delete process.env.TIENDANUBE_CLIENT_SECRET;

    const result = await exchangeCodeForToken("some-code");

    expect(result).toEqual({ ok: false, error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts client_id/client_secret/grant_type/code to the official token endpoint, in the body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_real", token_type: "bearer", scope: "read_products", user_id: "999" }),
    });

    await exchangeCodeForToken("auth-code-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.tiendanube.com/apps/authorize/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      client_id: "40899",
      client_secret: "test-secret",
      grant_type: "authorization_code",
      code: "auth-code-123",
    });
  });

  it("returns the access token, scope, and store id (from user_id) on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_real", token_type: "bearer", scope: "read_products,write_products", user_id: "999" }),
    });

    const result = await exchangeCodeForToken("auth-code-123");

    expect(result).toEqual({
      ok: true,
      accessToken: "tok_real",
      tokenType: "bearer",
      scope: "read_products,write_products",
      storeId: "999",
    });
  });

  it("falls back to store_id if the response uses that field name instead of user_id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_real", store_id: "777" }),
    });

    const result = await exchangeCodeForToken("auth-code-123");

    expect(result).toEqual({ ok: true, accessToken: "tok_real", tokenType: "bearer", scope: null, storeId: "777" });
  });

  it("fails cleanly (never fabricates a token) when Tiendanube returns a non-2xx status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) });

    const result = await exchangeCodeForToken("expired-or-reused-code");

    expect(result).toEqual({ ok: false, error: "token_exchange_failed_400" });
  });

  it("fails cleanly when the response has no access_token despite a 200", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ token_type: "bearer" }) });

    const result = await exchangeCodeForToken("some-code");

    expect(result).toEqual({ ok: false, error: "token_exchange_failed_200" });
  });

  it("fails cleanly when neither user_id nor store_id is present", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: "tok_real" }) });

    const result = await exchangeCodeForToken("some-code");

    expect(result).toEqual({ ok: false, error: "missing_store_id" });
  });

  it("handles a network error without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const result = await exchangeCodeForToken("some-code");

    expect(result).toEqual({ ok: false, error: "network_error" });
  });

  it("times out instead of hanging forever", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const result = await exchangeCodeForToken("some-code");

    expect(result).toEqual({ ok: false, error: "timeout" });
  });
});
