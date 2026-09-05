import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllDevotionals } from "@/lib/admin/devotional-queries";
import { Link } from "@/i18n/navigation";
import { DevotionalStatusButton } from "@/components/ui/DevotionalStatusButton";
import { DevotionalDeleteButton } from "@/components/ui/DevotionalDeleteButton";
import { getDevotionalExcerpt } from "@/components/ui/DevotionalContent";

export default async function AdminDevotionalsPage({
  params,
}: PageProps<"/[locale]/admin/devotionals">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.devotionals");

  const devotionals = await listAllDevotionals();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("count", { count: devotionals.length })}</p>
        <Link
          href="/admin/devotionals/new"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("addNew")}
        </Link>
      </div>

      {devotionals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("columns.title")}</th>
                <th className="px-6 py-4">{t("columns.status")}</th>
                <th className="px-6 py-4">{t("columns.author")}</th>
                <th className="px-6 py-4">{t("columns.created")}</th>
                <th className="px-6 py-4">{t("columns.published")}</th>
                <th className="px-6 py-4">{t("columns.updated")}</th>
                <th className="px-6 py-4">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {devotionals.map((devotional) => (
                <tr key={devotional.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-6 py-4 text-text">
                    <Link href={`/admin/devotionals/${devotional.id}/edit`} className="font-medium underline">
                      {devotional.title}
                    </Link>
                    <p className="mt-1 max-w-xs text-xs text-muted">{getDevotionalExcerpt(devotional.content, 90)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        devotional.status === "published"
                          ? "bg-success/15 text-success"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {t(`status.${devotional.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted">{devotional.authorName ?? "—"}</td>
                  <td className="px-6 py-4 text-muted">
                    {new Date(devotional.created_at).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {devotional.published_at ? new Date(devotional.published_at).toLocaleDateString(locale) : "—"}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {new Date(devotional.updated_at).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/devotionals/${devotional.id}/edit`}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                      >
                        {t("edit")}
                      </Link>
                      <DevotionalStatusButton id={devotional.id} status={devotional.status} />
                      <DevotionalDeleteButton id={devotional.id} title={devotional.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
