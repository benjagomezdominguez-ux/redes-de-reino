import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireAdminMock = vi.fn();
const isWhatsAppConfiguredMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));
vi.mock("@/lib/whatsapp/provider", () => ({ isWhatsAppConfigured: isWhatsAppConfiguredMock }));

const {
  createGroup,
  setGroupStatus,
  addContact,
  removeContact,
  createCampaign,
  saveMessage,
  requestMessageImageUploadUrl,
  attachMessageImage,
  activateCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
} = await import("./admin-whatsapp");

// Mirrors a real <form>: every optional field these actions read is
// always present in FormData (empty string if not filled in) —
// FormData.get() only returns null for a key that was never part of the
// form at all, and these schemas' `.optional().or(z.literal(""))` treats
// null (missing key) as a parse failure, not as "not provided".
function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  const defaults = {
    displayName: "",
    cycleDurationDays: "",
    templateName: "",
    templateLanguage: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...fields })) formData.set(key, value);
  return formData;
}

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  store = new FakeStore();
  requireAdminMock.mockReset();
  isWhatsAppConfiguredMock.mockReset();
  requireAdminMock.mockResolvedValue({ id: "admin-1", role: "admin" });
  isWhatsAppConfiguredMock.mockReturnValue(true);
});

describe("groups", () => {
  it("CRITICAL: createGroup never writes if requireAdmin rejects", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));

    await expect(createGroup({ status: "idle" }, buildFormData({ name: "Jóvenes" }))).rejects.toThrow("REDIRECT");
    expect(store.tables.whatsapp_groups ?? []).toHaveLength(0);
  });

  it("creates a group and logs it to the audit trail", async () => {
    const result = await createGroup({ status: "idle" }, buildFormData({ name: "Jóvenes" }));

    expect(result.status).toBe("success");
    expect(store.tables.whatsapp_groups).toHaveLength(1);
    expect(store.tables.audit_log[0]).toMatchObject({ action: "whatsapp_group_created", actor_id: "admin-1" });
  });

  it("rejects an empty name", async () => {
    const result = await createGroup({ status: "idle" }, buildFormData({ name: "" }));
    expect(result).toEqual({ status: "error", errorKey: "required" });
  });

  it("setGroupStatus toggles status and logs the action", async () => {
    store.seed("whatsapp_groups", [{ id: GROUP_ID, name: "G", status: "active" }]);

    await setGroupStatus(GROUP_ID, "inactive");

    expect(store.tables.whatsapp_groups[0].status).toBe("inactive");
    expect(store.tables.audit_log[0]).toMatchObject({ action: "whatsapp_group_deactivated" });
  });
});

describe("contacts", () => {
  it("rejects a phone number that isn't E.164", async () => {
    const result = await addContact({ status: "idle" }, buildFormData({ groupId: GROUP_ID, phone: "01122334455" }));
    expect(result).toEqual({ status: "error", errorKey: "invalidPhone" });
  });

  it("adds a contact and bumps the group's last_activity_at", async () => {
    store.seed("whatsapp_groups", [{ id: GROUP_ID, name: "G", status: "active", last_activity_at: "2020-01-01" }]);

    const result = await addContact({ status: "idle" }, buildFormData({ groupId: GROUP_ID, phone: "+5491122334455" }));

    expect(result.status).toBe("success");
    expect(store.tables.whatsapp_contacts).toHaveLength(1);
    expect(store.tables.whatsapp_groups[0].last_activity_at).not.toBe("2020-01-01");
  });

  it("refuses a duplicate phone number within the same group", async () => {
    store.seed("whatsapp_groups", [{ id: GROUP_ID, name: "G", status: "active" }]);
    store.seed("whatsapp_contacts", [{ id: "c1", group_id: GROUP_ID, phone_e164: "+5491122334455" }]);

    const result = await addContact({ status: "idle" }, buildFormData({ groupId: GROUP_ID, phone: "+5491122334455" }));

    expect(result).toEqual({ status: "error", errorKey: "duplicatePhone" });
    expect(store.tables.whatsapp_contacts).toHaveLength(1);
  });

  it("removeContact deletes the row and logs the action", async () => {
    store.seed("whatsapp_contacts", [{ id: "c1", group_id: GROUP_ID, phone_e164: "+5491122334455" }]);

    await removeContact("c1", GROUP_ID);

    expect(store.tables.whatsapp_contacts).toHaveLength(0);
    expect(store.tables.audit_log[0]).toMatchObject({ action: "whatsapp_contact_removed" });
  });
});

describe("campaigns and messages", () => {
  it("createCampaign defaults cycle duration to 30 days", async () => {
    const result = await createCampaign(
      { status: "idle" },
      buildFormData({ groupId: GROUP_ID, name: "Septiembre", startDate: "2026-09-01", timezone: "America/Argentina/Buenos_Aires" })
    );

    expect(result.status).toBe("success");
    expect(store.tables.whatsapp_campaigns[0]).toMatchObject({ cycle_duration_days: 30 });
  });

  it("saveMessage is refused once a campaign is active — content can't drift mid-cycle", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "active" }]);

    const result = await saveMessage(
      { status: "idle" },
      buildFormData({
        campaignId: CAMPAIGN_ID,
        sequencePosition: "1",
        title: "Mensaje 1",
        bodyText: "hola",
        scheduledDate: "2026-09-01",
        scheduledTime: "18:00",
      })
    );

    expect(result).toEqual({ status: "error", errorKey: "generic" });
    expect(store.tables.whatsapp_messages ?? []).toHaveLength(0);
  });

  it("saveMessage upserts by (campaignId, position) while the campaign is a draft", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "draft" }]);

    const result = await saveMessage(
      { status: "idle" },
      buildFormData({
        campaignId: CAMPAIGN_ID,
        sequencePosition: "1",
        title: "Mensaje 1",
        bodyText: "hola",
        scheduledDate: "2026-09-01",
        scheduledTime: "18:00",
      })
    );

    expect(result.status).toBe("success");
    expect(store.tables.whatsapp_messages).toHaveLength(1);
  });

  it("CRITICAL: requestMessageImageUploadUrl never mints a URL if requireAdmin rejects", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(requestMessageImageUploadUrl(CAMPAIGN_ID, "png")).rejects.toThrow("REDIRECT");
  });

  it("attachMessageImage records the storage path and logs it", async () => {
    store.seed("whatsapp_messages", [{ id: "m1", campaign_id: CAMPAIGN_ID, image_storage_path: null }]);

    const result = await attachMessageImage("m1", "path/to/image.png");

    expect(result.ok).toBe(true);
    expect(store.tables.whatsapp_messages[0].image_storage_path).toBe("path/to/image.png");
  });
});

function seedActivatableCampaign() {
  store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, group_id: GROUP_ID, status: "draft" }]);
  store.seed("whatsapp_contacts", [{ id: "c1", group_id: GROUP_ID, phone_e164: "+5491122334455" }]);
  store.seed(
    "whatsapp_messages",
    [1, 2, 3, 4].map((position) => ({
      id: `m${position}`,
      campaign_id: CAMPAIGN_ID,
      sequence_position: position,
      title: `Mensaje ${position}`,
      body_text: "hola",
      image_storage_path: `path-${position}.png`,
      scheduled_date: "2026-09-01",
      scheduled_time: "18:00",
    }))
  );
}

describe("activateCampaign — rule 39, never activates an incomplete campaign", () => {
  it("CRITICAL: refuses when the official WhatsApp integration isn't configured", async () => {
    isWhatsAppConfiguredMock.mockReturnValue(false);
    seedActivatableCampaign();

    const result = await activateCampaign(CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, errorKey: "notConfigured" });
    expect(store.tables.whatsapp_campaigns[0].status).toBe("draft");
  });

  it("TEST 4: refuses when a message is missing (e.g. no message 4)", async () => {
    seedActivatableCampaign();
    store.tables.whatsapp_messages = store.tables.whatsapp_messages.filter((m) => m.sequence_position !== 4);

    const result = await activateCampaign(CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, errorKey: "incomplete" });
  });

  it("refuses when a message is missing its image", async () => {
    seedActivatableCampaign();
    store.tables.whatsapp_messages[0].image_storage_path = null;

    const result = await activateCampaign(CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, errorKey: "incomplete" });
  });

  it("refuses when the group has no contacts", async () => {
    seedActivatableCampaign();
    store.tables.whatsapp_contacts = [];

    const result = await activateCampaign(CAMPAIGN_ID);

    expect(result).toEqual({ ok: false, errorKey: "noContacts" });
  });

  it("TEST 5: activates once everything required is actually in place", async () => {
    seedActivatableCampaign();

    const result = await activateCampaign(CAMPAIGN_ID);

    expect(result).toEqual({ ok: true });
    expect(store.tables.whatsapp_campaigns[0].status).toBe("active");
    expect(store.tables.audit_log[0]).toMatchObject({ action: "whatsapp_campaign_activated" });
  });
});

describe("campaign lifecycle", () => {
  it("pauseCampaign only takes effect on an active campaign", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "draft" }]);

    await pauseCampaign(CAMPAIGN_ID);

    expect(store.tables.whatsapp_campaigns[0].status).toBe("draft");
  });

  it("pauseCampaign then resumeCampaign round-trips back to active", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "active" }]);

    await pauseCampaign(CAMPAIGN_ID);
    expect(store.tables.whatsapp_campaigns[0].status).toBe("paused");

    await resumeCampaign(CAMPAIGN_ID);
    expect(store.tables.whatsapp_campaigns[0].status).toBe("active");
  });

  it("cancelCampaign records who cancelled it and why", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "active" }]);

    await cancelCampaign(CAMPAIGN_ID, "ya no aplica");

    expect(store.tables.whatsapp_campaigns[0]).toMatchObject({ status: "cancelled", cancelled_by: "admin-1", cancel_reason: "ya no aplica" });
  });

  it("cancelCampaign never reopens an already-completed campaign", async () => {
    store.seed("whatsapp_campaigns", [{ id: CAMPAIGN_ID, status: "completed" }]);

    await cancelCampaign(CAMPAIGN_ID, "");

    expect(store.tables.whatsapp_campaigns[0].status).toBe("completed");
  });
});
