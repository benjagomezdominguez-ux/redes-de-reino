import { getTranslations, setRequestLocale } from "next-intl/server";
import { getWhatsAppDashboardCounts } from "@/lib/admin/whatsapp-queries";
import { isWhatsAppConfigured } from "@/lib/whatsapp/provider";
import { isEmailConfigured } from "@/lib/email/provider";
import { Link } from "@/i18n/navigation";

export default async function AdminWhatsAppDashboardPage({
  params,
}: PageProps<"/[locale]/admin/whatsapp">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  const counts = await getWhatsAppDashboardCounts();
  const whatsappConfigured = isWhatsAppConfigured();
  const emailConfigured = isEmailConfigured();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/whatsapp/groups"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
        >
          {t("nav.groups")}
        </Link>
        <Link
          href="/admin/whatsapp/groups/new"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("dashboard.addGroup")}
        </Link>
      </div>

      {!whatsappConfigured ? (
        <p className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-5 text-sm text-error">
          {t("dashboard.notConfiguredWarning")}
        </p>
      ) : null}
      {!emailConfigured ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface-alt p-5 text-sm text-muted">
          {t("dashboard.emailNotConfiguredWarning")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
            {t("dashboard.activeGroups")}
          </span>
          <span className="font-display text-4xl font-medium text-primary-900">{counts.activeGroups}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
            {t("dashboard.activeCampaigns")}
          </span>
          <span className="font-display text-4xl font-medium text-primary-900">{counts.activeCampaigns}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
            {t("dashboard.nextMessage")}
          </span>
          <span className="font-display text-lg font-medium text-primary-900">
            {counts.nextMessage
              ? `${counts.nextMessage.scheduled_date} · ${counts.nextMessage.scheduled_time.slice(0, 5)}`
              : "—"}
          </span>
          {counts.nextMessage ? (
            <span className="text-xs text-muted">
              {counts.nextMessage.group_name} · {counts.nextMessage.campaign_name}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
            {t("dashboard.nextAlert")}
          </span>
          <span className="font-display text-lg font-medium text-primary-900">{counts.nextAlertDate ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
