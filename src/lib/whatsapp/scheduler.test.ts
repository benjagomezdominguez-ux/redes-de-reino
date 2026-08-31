import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "./scheduler.test-helpers";

const sendMessageMock = vi.fn();
const emailSendMock = vi.fn();
const getEmailProviderMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => store.client(),
}));
vi.mock("./provider", () => ({
  getWhatsAppProvider: () => ({ name: "fake", sendMessage: sendMessageMock }),
}));
vi.mock("@/lib/email/provider", () => ({
  getEmailProvider: getEmailProviderMock,
}));

const { runWhatsappScheduler, findBenjaminGomezEmail } = await import("./scheduler");

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const FAR_FUTURE = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

function farEndDate(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function seedGroup(id: string, contactPhones: string[] = ["+5491111111111"]) {
  store.seed("whatsapp_groups", [{ id, name: "Grupo", status: "active" }]);
  store.tables.whatsapp_contacts = contactPhones.map((phone, i) => ({
    id: `${id}-contact-${i}`,
    group_id: id,
    phone_e164: phone,
  }));
}

function seedCampaign(
  id: string,
  groupId: string,
  overrides: Partial<{ status: string; end_date: string; timezone: string }> = {}
) {
  const existing = store.tables.whatsapp_campaigns ?? [];
  existing.push({
    id,
    group_id: groupId,
    status: overrides.status ?? "active",
    end_date: overrides.end_date ?? FAR_FUTURE,
    timezone: overrides.timezone ?? "UTC",
  });
  store.tables.whatsapp_campaigns = existing;
}

function seedMessage(id: string, campaignId: string, position: number, overrides: Partial<Record<string, unknown>> = {}) {
  const existing = store.tables.whatsapp_messages ?? [];
  existing.push({
    id,
    campaign_id: campaignId,
    sequence_position: position,
    body_text: "hola",
    image_storage_path: null,
    whatsapp_template_name: "saludo",
    whatsapp_template_language: "es",
    scheduled_date: YESTERDAY,
    scheduled_time: "00:00",
    status: "scheduled",
    ...overrides,
  });
  store.tables.whatsapp_messages = existing;
}

beforeEach(() => {
  store = new FakeStore();
  sendMessageMock.mockReset();
  emailSendMock.mockReset();
  getEmailProviderMock.mockReset();
  sendMessageMock.mockResolvedValue({ ok: true, externalId: "wamid-1" });
  emailSendMock.mockResolvedValue({ externalId: "email-1" });
  getEmailProviderMock.mockReturnValue({ name: "fake-email", send: emailSendMock });
});

describe("runWhatsappScheduler — sending", () => {
  it("TEST 6: sends only the message that is currently due, not later ones", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1, { scheduled_date: YESTERDAY });
    seedMessage("m2", "c1", 2, { scheduled_date: FAR_FUTURE });

    const summary = await runWhatsappScheduler();

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(summary.messagesSent).toBe(1);
    const m2 = store.tables.whatsapp_messages.find((m) => m.id === "m2");
    expect(m2!.status).toBe("scheduled");
  });

  it("does not send a message before its scheduled date", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1, { scheduled_date: FAR_FUTURE });

    await runWhatsappScheduler();

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("TEST 7: running the scheduler twice never sends the same message to the same contact twice", async () => {
    seedGroup("g1", ["+5491111111111", "+5492222222222"]);
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1);

    await runWhatsappScheduler();
    expect(sendMessageMock).toHaveBeenCalledTimes(2);

    sendMessageMock.mockClear();
    await runWhatsappScheduler();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("TEST 8: a paused campaign never sends", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1", { status: "paused" });
    seedMessage("m1", "c1", 1);

    await runWhatsappScheduler();

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("TEST 9: a cancelled campaign never sends", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1", { status: "cancelled" });
    seedMessage("m1", "c1", 1);

    await runWhatsappScheduler();

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: respects strict order — message 2 is never touched while message 1 hasn't resolved", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1, { scheduled_date: YESTERDAY });
    seedMessage("m2", "c1", 2, { scheduled_date: YESTERDAY }); // also due, but must wait

    await runWhatsappScheduler();

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const m2 = store.tables.whatsapp_messages.find((m) => m.id === "m2");
    expect(m2!.status).toBe("scheduled");
  });

  it("retries a failed delivery on the next run instead of giving up immediately", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1);
    sendMessageMock.mockResolvedValueOnce({ ok: false, errorCode: "500", errorMessage: "temporary" });

    await runWhatsappScheduler();
    let delivery = store.tables.whatsapp_message_deliveries[0];
    expect(delivery.status).toBe("pending");
    expect(delivery.attempt_count).toBe(1);

    sendMessageMock.mockResolvedValueOnce({ ok: true, externalId: "wamid-2" });
    await runWhatsappScheduler();
    delivery = store.tables.whatsapp_message_deliveries[0];
    expect(delivery.status).toBe("sent");
  });

  it("marks a delivery FAILED (not retried forever) once max attempts are exhausted", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1);
    sendMessageMock.mockResolvedValue({ ok: false, errorCode: "131047", errorMessage: "permanent" });

    await runWhatsappScheduler();
    await runWhatsappScheduler();
    await runWhatsappScheduler();
    await runWhatsappScheduler();

    const delivery = store.tables.whatsapp_message_deliveries[0];
    expect(delivery.status).toBe("failed");
    expect(delivery.attempt_count).toBe(3);
    // A 4th run must not attempt again — exhausted deliveries are excluded.
    sendMessageMock.mockClear();
    await runWhatsappScheduler();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("TEST 10: once every message resolves, the campaign is marked COMPLETED", async () => {
    seedGroup("g1");
    seedCampaign("c1", "g1");
    seedMessage("m1", "c1", 1, { status: "sent" });
    seedMessage("m2", "c1", 2, { status: "sent" });
    seedMessage("m3", "c1", 3, { status: "sent" });
    seedMessage("m4", "c1", 4, { status: "sent" });

    const summary = await runWhatsappScheduler();

    expect(summary.campaignsCompleted).toBe(1);
    const campaign = store.tables.whatsapp_campaigns.find((c) => c.id === "c1");
    expect(campaign!.status).toBe("completed");
    expect(campaign!.completed_at).toBeTruthy();
  });

  it("TEST 13: three independent groups/campaigns each progress on their own", async () => {
    seedGroup("g1");
    seedGroup("g2");
    seedGroup("g3");
    seedCampaign("c1", "g1");
    seedCampaign("c2", "g2");
    seedCampaign("c3", "g3");
    seedMessage("m1", "c1", 1, { scheduled_date: YESTERDAY });
    seedMessage("m2", "c2", 1, { scheduled_date: FAR_FUTURE }); // not due
    seedMessage("m3", "c3", 1, { scheduled_date: YESTERDAY });

    const summary = await runWhatsappScheduler();

    expect(summary.campaignsProcessed).toBe(3);
    expect(summary.messagesSent).toBe(2);
    expect(store.tables.whatsapp_messages.find((m) => m.id === "m1")!.status).toBe("sent");
    expect(store.tables.whatsapp_messages.find((m) => m.id === "m2")!.status).toBe("scheduled");
    expect(store.tables.whatsapp_messages.find((m) => m.id === "m3")!.status).toBe("sent");
  });
});

describe("runWhatsappScheduler — 5-days-before alert", () => {
  it("TEST 11: sends the alert to Benjamín Gómez, found in profiles, when 5 days remain", async () => {
    store.seed("profiles", [
      { id: "u1", first_name: "benjamin", last_name: "gomez", email: "benjagomezdominguez@gmail.com", role: "admin", status: "active" },
    ]);
    seedGroup("g1");
    seedCampaign("c1", "g1", { end_date: farEndDate(3) });

    const summary = await runWhatsappScheduler();

    expect(emailSendMock).toHaveBeenCalledTimes(1);
    expect(emailSendMock.mock.calls[0][0].to).toBe("benjagomezdominguez@gmail.com");
    expect(summary.alertsSent).toBe(1);
    expect(store.tables.whatsapp_notifications).toHaveLength(1);
  });

  it("TEST 12: running the scheduler again never sends the alert twice", async () => {
    store.seed("profiles", [
      { id: "u1", first_name: "benjamin", last_name: "gomez", email: "benjagomezdominguez@gmail.com", role: "admin", status: "active" },
    ]);
    seedGroup("g1");
    seedCampaign("c1", "g1", { end_date: farEndDate(3) });

    await runWhatsappScheduler();
    emailSendMock.mockClear();
    await runWhatsappScheduler();

    expect(emailSendMock).not.toHaveBeenCalled();
  });

  it("does not alert when more than 5 days remain", async () => {
    store.seed("profiles", [
      { id: "u1", first_name: "benjamin", last_name: "gomez", email: "benjagomezdominguez@gmail.com", role: "admin", status: "active" },
    ]);
    seedGroup("g1");
    seedCampaign("c1", "g1", { end_date: farEndDate(20) });

    await runWhatsappScheduler();

    expect(emailSendMock).not.toHaveBeenCalled();
  });

  it("never fakes an alert as sent when no email provider is configured", async () => {
    store.seed("profiles", [
      { id: "u1", first_name: "benjamin", last_name: "gomez", email: "benjagomezdominguez@gmail.com", role: "admin", status: "active" },
    ]);
    seedGroup("g1");
    seedCampaign("c1", "g1", { end_date: farEndDate(2) });

    getEmailProviderMock.mockReturnValueOnce(null);

    const summary = await runWhatsappScheduler();

    expect(summary.alertsSent).toBe(0);
    expect(store.tables.whatsapp_notifications ?? []).toHaveLength(0);
  });
});

describe("findBenjaminGomezEmail", () => {
  it("finds the admin by name in the real profiles table, never a hardcoded address", async () => {
    store.seed("profiles", [
      { id: "u1", first_name: "benjamin", last_name: "gomez", email: "benjagomezdominguez@gmail.com", role: "admin", status: "active" },
      { id: "u2", first_name: "otro", last_name: "usuario", email: "otro@example.com", role: "user", status: "active" },
    ]);

    const email = await findBenjaminGomezEmail();

    expect(email).toBe("benjagomezdominguez@gmail.com");
  });

  it("returns null when no matching admin exists, rather than guessing", async () => {
    store.seed("profiles", [{ id: "u2", first_name: "otro", last_name: "usuario", email: "otro@example.com", role: "admin", status: "active" }]);

    const email = await findBenjaminGomezEmail();

    expect(email).toBeNull();
  });
});
