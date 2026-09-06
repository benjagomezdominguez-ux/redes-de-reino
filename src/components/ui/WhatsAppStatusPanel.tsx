import { getTranslations } from "next-intl/server";
import { checkWhatsAppConnection } from "@/lib/whatsapp/meta-provider";

// A live status panel, not just a static "is env var set" warning — it
// actually calls Meta's API (checkWhatsAppConnection) so "operational"
// means the token and phone number id are genuinely valid right now, not
// merely present. Never renders a secret value, only configured/not.
export async function WhatsAppStatusPanel() {
  const t = await getTranslations("admin.whatsapp.dashboard.status");
  const check = await checkWhatsAppConnection();

  const tone =
    check.connectionStatus === "ok"
      ? { emoji: "🟢", label: t("ok"), border: "border-success/40", bg: "bg-success/5", headline: "text-success" }
      : check.connectionStatus === "invalid"
        ? {
            emoji: "🟠",
            label: t("invalid"),
            border: "border-secondary-500/40",
            bg: "bg-secondary-500/10",
            headline: "text-secondary-700",
          }
        : { emoji: "🔴", label: t("missing"), border: "border-error/40", bg: "bg-error/5", headline: "text-error" };

  const configured = t("configured");
  const notConfigured = t("notConfigured");

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-dashed p-5 text-sm ${tone.border} ${tone.bg}`}>
      <p className={`font-semibold ${tone.headline}`}>
        <span aria-hidden="true">{tone.emoji}</span> {t("title")}: {tone.label}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-text sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <dt className="font-medium">{t("token")}:</dt>
          <dd>{check.tokenConfigured ? configured : notConfigured}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium">{t("phoneNumberId")}:</dt>
          <dd>{check.phoneNumberIdConfigured ? configured : notConfigured}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium">{t("businessAccountId")}:</dt>
          <dd>{check.businessAccountIdConfigured ? configured : notConfigured}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium">{t("connection")}:</dt>
          <dd>
            {check.connectionStatus === "ok"
              ? t("connectionOk")
              : check.connectionStatus === "invalid"
                ? t("connectionError", { message: check.connectionError ?? "" })
                : t("connectionNotVerified")}
          </dd>
        </div>
      </dl>
      {check.connectionStatus !== "ok" ? <p className="text-xs text-muted">{t("hint")}</p> : null}
    </div>
  );
}
