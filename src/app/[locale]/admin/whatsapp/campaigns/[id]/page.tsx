import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCampaignDetail } from "@/lib/admin/whatsapp-queries";
import { Link } from "@/i18n/navigation";
import { WhatsAppMessageForm } from "@/components/ui/WhatsAppMessageForm";
import { WhatsAppCampaignControls } from "@/components/ui/WhatsAppCampaignControls";

export default async function AdminWhatsAppCampaignDetailPage({
  params,
}: PageProps<"/[locale]/admin/whatsapp/campaigns/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  const detail = await getCampaignDetail(id);
  if (!detail) notFound();
  const { campaign, messages } = detail;
  const editable = campaign.status === "draft" || campaign.status === "paused";

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/whatsapp/groups/${campaign.group_id}`} className="text-sm font-medium text-primary-900/80 underline">
        {t("groupDetail.backToGroup", { name: campaign.group_name })}
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-primary-900">{campaign.name}</h2>
          <p className="text-sm text-muted">
            {campaign.start_date} → {campaign.end_date} · {campaign.timezone}
          </p>
          <span className="mt-1 inline-block rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
            {t(`campaignStatus.${campaign.status}`)}
          </span>
        </div>
        <WhatsAppCampaignControls campaignId={campaign.id} status={campaign.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((position) => (
          <WhatsAppMessageForm
            key={position}
            campaignId={campaign.id}
            position={position}
            message={messages.find((m) => m.sequence_position === position)}
            editable={editable}
          />
        ))}
      </div>
    </div>
  );
}
