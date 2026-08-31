import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { WhatsAppGroupForm } from "@/components/ui/WhatsAppGroupForm";

export default async function NewWhatsAppGroupPage({
  params,
}: PageProps<"/[locale]/admin/whatsapp/groups/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/whatsapp/groups" className="text-sm font-medium text-primary-900/80 underline">
        {t("groups.backToList")}
      </Link>
      <div className="max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <WhatsAppGroupForm />
      </div>
    </div>
  );
}
