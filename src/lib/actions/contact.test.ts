import { describe, expect, it, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

const { submitContactForm } = await import("./contact");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const validFields = {
  name: "María López",
  email: "maria@example.com",
  phone: "",
  interest: "membresia",
  message: "Quiero sumarme a la comunidad.",
};

describe("submitContactForm", () => {
  beforeEach(() => {
    insertMock.mockReset();
    fromMock.mockClear();
    rpcMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it("inserts a valid submission and reports success", async () => {
    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("success");
    expect(rpcMock).toHaveBeenCalledWith("can_submit_contact_form", {
      p_email: "maria@example.com",
    });
    expect(fromMock).toHaveBeenCalledWith("contact_submissions");
    expect(insertMock).toHaveBeenCalledWith({
      name: "María López",
      email: "maria@example.com",
      phone: null,
      interest: "membresia",
      message: "Quiero sumarme a la comunidad.",
    });
  });

  it("rejects an invalid email without touching the database", async () => {
    const result = await submitContactForm(
      { status: "idle" },
      buildFormData({ ...validFields, email: "not-an-email" })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("emailInvalid");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a missing name without touching the database", async () => {
    const result = await submitContactForm(
      { status: "idle" },
      buildFormData({ ...validFields, name: "" })
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("nameRequired");
  });

  it("silently succeeds when the honeypot field is filled", async () => {
    const formData = buildFormData(validFields);
    formData.set("company", "I am a bot");

    const result = await submitContactForm({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("reports an error when the insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "db down" } });

    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("submitFailed");
  });

  it("blocks a resubmission within the rate-limit window", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("rateLimited");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("reports an error when the rate-limit check itself fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc down" } });

    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("error");
    expect(result.errorKey).toBe("submitFailed");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
