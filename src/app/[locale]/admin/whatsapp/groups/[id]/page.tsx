import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGroupDetail } from "@/lib/admin/whatsapp-queries";
import { Link } from "@/i18n/navigation";
import { WhatsAppContactForm } from "@/components/ui/WhatsAppContactForm";
import { WhatsAppContactList } from "@/components/ui/WhatsAppContactList";
import { WhatsAppGroupStatusButton } from "@/components/ui/WhatsAppGroupStatusButton";

export default async function AdminWhatsAppGroupDetailPage({
  params,
}: PageProps<"/[locale]/admin/whatsapp/groups/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  const detail = await getGroupDetail(id);
  if (!detail) notFound();
  const { group, contacts, campaigns } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/whatsapp/groups" className="text-sm font-medium text-primary-900/80 underline">
        {t("groups.backToList")}
      </Link>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-primary-900">{group.name}</h2>
          <span
            className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              group.status === "active" ? "bg-success/15 text-success" : "bg-muted/20 text-muted"
            }`}
          >
            {t(`groups.status.${group.status}`)}
          </span>
        </div>
        <WhatsAppGroupStatusButton groupId={group.id} status={group.status as "active" | "inactive"} />
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-lg font-medium text-primary-900">{t("groupDetail.contacts")}</h3>
        <WhatsAppContactForm groupId={group.id} />
        <WhatsAppContactList groupId={group.id} contacts={contacts} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-primary-900">{t("groupDetail.campaigns")}</h3>
          <Link
            href={`/admin/whatsapp/campaigns/new?groupId=${group.id}`}
            className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            {t("groupDetail.newCampaign")}
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
            {t("groupDetail.noCampaigns")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-soft">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <Link href={`/admin/whatsapp/campaigns/${campaign.id}`} className="font-medium text-text underline">
                    {campaign.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {campaign.start_date} → {campaign.end_date}
                  </p>
                </div>
                <span className="rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
                  {t(`campaignStatus.${campaign.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
