import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGroupDetail } from "@/lib/admin/whatsapp-queries";
import { Link } from "@/i18n/navigation";
import { WhatsAppCampaignForm } from "@/components/ui/WhatsAppCampaignForm";

export default async function NewWhatsAppCampaignPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/whatsapp/campaigns/new">) {
  const { locale } = await params;
  const { groupId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  if (typeof groupId !== "string") notFound();
  const detail = await getGroupDetail(groupId);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/whatsapp/groups/${groupId}`} className="text-sm font-medium text-primary-900/80 underline">
        {t("groupDetail.backToGroup", { name: detail.group.name })}
      </Link>
      <div className="max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <WhatsAppCampaignForm groupId={groupId} />
      </div>
    </div>
  );
}
