import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDevotionalForEdit } from "@/lib/admin/devotional-queries";
import { DevotionalForm } from "@/components/ui/DevotionalForm";
import { Link } from "@/i18n/navigation";

export default async function AdminEditDevotionalPage({
  params,
}: PageProps<"/[locale]/admin/devotionals/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.devotionals");

  const devotional = await getDevotionalForEdit(id);
  if (!devotional) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/devotionals" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="mb-6 font-display text-lg font-medium text-primary-900">{devotional.title}</h2>
        <DevotionalForm
          mode="edit"
          initial={{
            id: devotional.id,
            title: devotional.title,
            content: devotional.content,
            status: devotional.status,
          }}
        />
      </div>
    </div>
  );
}
