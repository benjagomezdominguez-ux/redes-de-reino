import { describe, expect, it, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
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
    insertMock.mockResolvedValue({ error: null });
  });

  it("inserts a valid submission and reports success", async () => {
    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("success");
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
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("silently succeeds when the honeypot field is filled", async () => {
    const formData = buildFormData(validFields);
    formData.set("company", "I am a bot");

    const result = await submitContactForm({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("reports an error when the insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "db down" } });

    const result = await submitContactForm(
      { status: "idle" },
      buildFormData(validFields)
    );

    expect(result.status).toBe("error");
  });
});
