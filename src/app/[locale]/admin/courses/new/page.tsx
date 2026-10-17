import { getTranslations, setRequestLocale } from "next-intl/server";
import { CourseForm } from "@/components/ui/CourseForm";
import { Link } from "@/i18n/navigation";

export default async function AdminNewCoursePage({
  params,
}: PageProps<"/[locale]/admin/courses/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.courses");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/courses" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="mb-6 font-display text-lg font-medium text-primary-900">{t("addNew")}</h2>
        <CourseForm mode="create" />
      </div>
    </div>
  );
}
