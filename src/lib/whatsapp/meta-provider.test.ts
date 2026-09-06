import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const downloadMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: { from: () => ({ download: downloadMock }) },
  }),
}));

const { metaCloudApiProvider, checkWhatsAppConnection } = await import("./meta-provider");

const originalEnv = { ...process.env };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  downloadMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.WHATSAPP_CLOUD_API_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

const BASE_PARAMS = {
  to: "+5491122334455",
  text: "Hola, esto es un mensaje de prueba.",
  imageStoragePath: null as string | null,
  templateName: null as string | null,
  templateLanguage: "es",
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("metaCloudApiProvider.sendMessage", () => {
  it("returns not_configured without ever calling fetch when env vars are missing", async () => {
    delete process.env.WHATSAPP_CLOUD_API_TOKEN;
    const result = await metaCloudApiProvider.sendMessage(BASE_PARAMS);
    expect(result).toEqual({ ok: false, errorCode: "not_configured", errorMessage: "WhatsApp Cloud API env vars missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: sends a freeform text message to the correct, current Graph API endpoint with the real token as a Bearer header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.abc123" }] }));

    const result = await metaCloudApiProvider.sendMessage(BASE_PARAMS);

    expect(result).toEqual({ ok: true, externalId: "wamid.abc123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v26.0/1234567890/messages");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Content-Type"]).toBe("application/json");
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "+5491122334455",
      type: "text",
      text: { body: "Hola, esto es un mensaje de prueba." },
    });
  });

  it("sends an approved-template message with the body text as a variable, no header when there's no image", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.tpl1" }] }));

    await metaCloudApiProvider.sendMessage({ ...BASE_PARAMS, templateName: "monthly_update", templateLanguage: "es" });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "+5491122334455",
      type: "template",
      template: {
        name: "monthly_update",
        language: { code: "es" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Hola, esto es un mensaje de prueba." }] }],
      },
    });
  });

  it("CRITICAL: uploads the image to Meta's Media API first (never an external URL) and uses the returned media id", async () => {
    downloadMock.mockResolvedValue({ data: new Blob(["fake-image-bytes"], { type: "image/jpeg" }), error: null });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "media-id-123" })) // media upload
      .mockResolvedValueOnce(jsonResponse(200, { messages: [{ id: "wamid.img1" }] })); // send

    const result = await metaCloudApiProvider.sendMessage({ ...BASE_PARAMS, imageStoragePath: "campaign-1/photo.jpg" });

    expect(result).toEqual({ ok: true, externalId: "wamid.img1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [mediaUrl, mediaOptions] = fetchMock.mock.calls[0];
    expect(mediaUrl).toBe("https://graph.facebook.com/v26.0/1234567890/media");
    expect(mediaOptions.headers.Authorization).toBe("Bearer test-token");
    expect(mediaOptions.body).toBeInstanceOf(FormData);
    expect(mediaOptions.body.get("messaging_product")).toBe("whatsapp");

    const sendPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sendPayload).toEqual({
      messaging_product: "whatsapp",
      to: "+5491122334455",
      type: "image",
      image: { id: "media-id-123", caption: "Hola, esto es un mensaje de prueba." },
    });
  });

  it("attaches the uploaded media id as the template's header image, alongside the body variable", async () => {
    downloadMock.mockResolvedValue({ data: new Blob(["fake-image-bytes"], { type: "image/jpeg" }), error: null });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "media-id-456" }))
      .mockResolvedValueOnce(jsonResponse(200, { messages: [{ id: "wamid.tpl2" }] }));

    await metaCloudApiProvider.sendMessage({
      ...BASE_PARAMS,
      imageStoragePath: "campaign-1/photo.jpg",
      templateName: "monthly_update",
    });

    const sendPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sendPayload.template.components).toEqual([
      { type: "header", parameters: [{ type: "image", image: { id: "media-id-456" } }] },
      { type: "body", parameters: [{ type: "text", text: "Hola, esto es un mensaje de prueba." }] },
    ]);
  });

  it("CRITICAL: a Storage read failure surfaces as media_upload_failed and never attempts to send the message", async () => {
    downloadMock.mockResolvedValue({ data: null, error: { message: "object not found" } });

    const result = await metaCloudApiProvider.sendMessage({ ...BASE_PARAMS, imageStoragePath: "missing.jpg" });

    expect(result.ok).toBe(false);
    expect((result as { errorCode: string }).errorCode).toBe("media_upload_failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a Meta Media API error surfaces as media_upload_failed with Meta's real error message", async () => {
    downloadMock.mockResolvedValue({ data: new Blob(["bytes"], { type: "image/jpeg" }), error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: { message: "Unsupported image format" } }));

    const result = await metaCloudApiProvider.sendMessage({ ...BASE_PARAMS, imageStoragePath: "bad.jpg" });

    expect(result).toEqual({ ok: false, errorCode: "media_upload_failed", errorMessage: "Unsupported image format" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("CRITICAL: maps a real Meta error response (error.code/error.message) faithfully, never inventing a generic message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: 131047, message: "Re-engagement message outside allowed window" } })
    );

    const result = await metaCloudApiProvider.sendMessage(BASE_PARAMS);

    expect(result).toEqual({
      ok: false,
      errorCode: "131047",
      errorMessage: "Re-engagement message outside allowed window",
    });
  });

  it("falls back to the HTTP status when Meta's response has no error body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const result = await metaCloudApiProvider.sendMessage(BASE_PARAMS);

    expect(result).toEqual({ ok: false, errorCode: "500", errorMessage: "WhatsApp send failed (500)" });
  });

  it("treats a 200 response with no message id as a failure rather than a false success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const result = await metaCloudApiProvider.sendMessage(BASE_PARAMS);

    expect(result.ok).toBe(false);
  });
});

describe("checkWhatsAppConnection", () => {
  beforeEach(() => {
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "9876543210";
  });

  it("CRITICAL: is not_configured and never calls fetch when any of the three required env vars is missing", async () => {
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    const result = await checkWhatsAppConnection();

    expect(result).toEqual({
      tokenConfigured: true,
      phoneNumberIdConfigured: true,
      businessAccountIdConfigured: false,
      connectionStatus: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: calls the correct read-only Graph API endpoint with the Bearer token, and reports ok when Meta confirms the phone number", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "1234567890", verified_name: "Redes de Reino" }));

    const result = await checkWhatsAppConnection();

    expect(result).toEqual({
      tokenConfigured: true,
      phoneNumberIdConfigured: true,
      businessAccountIdConfigured: true,
      connectionStatus: "ok",
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v26.0/1234567890?fields=verified_name,display_phone_number");
    expect(options.headers.Authorization).toBe("Bearer test-token");
  });

  it("CRITICAL: reports invalid (not ok) with Meta's real error message when the token is rejected — never a false 'operational' state", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: "Invalid OAuth access token" } }));

    const result = await checkWhatsAppConnection();

    expect(result).toEqual({
      tokenConfigured: true,
      phoneNumberIdConfigured: true,
      businessAccountIdConfigured: true,
      connectionStatus: "invalid",
      connectionError: "Invalid OAuth access token",
    });
  });

  it("reports invalid on a network-level failure without leaking the raw exception", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed: getaddrinfo ENOTFOUND graph.facebook.com"));

    const result = await checkWhatsAppConnection();

    expect(result.connectionStatus).toBe("invalid");
    expect(result.connectionError).not.toContain("ENOTFOUND");
  });

  it("treats a 200 response missing the expected id field as invalid, not ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const result = await checkWhatsAppConnection();

    expect(result.connectionStatus).toBe("invalid");
  });
});
