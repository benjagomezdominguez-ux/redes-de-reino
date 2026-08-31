import { getTranslations, setRequestLocale } from "next-intl/server";
import { listGroups } from "@/lib/admin/whatsapp-queries";
import { Link } from "@/i18n/navigation";

export default async function AdminWhatsAppGroupsPage({
  params,
}: PageProps<"/[locale]/admin/whatsapp/groups">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.whatsapp");

  const groups = await listGroups();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("groups.count", { count: groups.length })}</p>
        <Link
          href="/admin/whatsapp/groups/new"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("groups.addNew")}
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("groups.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("groups.columns.name")}</th>
                <th className="px-6 py-4">{t("groups.columns.contacts")}</th>
                <th className="px-6 py-4">{t("groups.columns.campaign")}</th>
                <th className="px-6 py-4">{t("groups.columns.status")}</th>
                <th className="px-6 py-4">{t("groups.columns.endDate")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 text-text">
                    <Link href={`/admin/whatsapp/groups/${group.id}`} className="font-medium underline">
                      {group.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted">{group.contact_count}</td>
                  <td className="px-6 py-4 text-muted">{group.latest_campaign?.name ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        group.status === "active" ? "bg-success/15 text-success" : "bg-muted/20 text-muted"
                      }`}
                    >
                      {t(`groups.status.${group.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted">{group.latest_campaign?.end_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
