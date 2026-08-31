import { getTranslations, setRequestLocale } from "next-intl/server";
import { listUsers } from "@/lib/admin/queries";
import { AdminPagination } from "@/components/ui/AdminPagination";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin.users");

  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listUsers(page, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("columns.user")}</th>
                <th className="px-6 py-4">{t("columns.email")}</th>
                <th className="px-6 py-4">{t("columns.registered")}</th>
                <th className="px-6 py-4">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 text-text">
                    {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                    {row.role === "admin" ? (
                      <span className="ml-2 rounded-full bg-secondary-300/60 px-2 py-0.5 text-xs font-semibold text-secondary-700">
                        {t("adminBadge")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-muted">{row.email ?? "—"}</td>
                  <td className="px-6 py-4 text-muted">
                    {new Date(row.created_at).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {t(`status.${row.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination basePath="/admin/users" page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
