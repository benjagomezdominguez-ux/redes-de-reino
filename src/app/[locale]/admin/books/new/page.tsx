import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookForm } from "@/components/ui/BookForm";
import { Link } from "@/i18n/navigation";

export default async function AdminNewBookPage({
  params,
}: PageProps<"/[locale]/admin/books/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.books");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/books" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="mb-6 font-display text-lg font-medium text-primary-900">{t("addNew")}</h2>
        <BookForm mode="create" />
      </div>
    </div>
  );
}
