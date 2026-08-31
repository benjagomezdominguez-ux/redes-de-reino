import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
}: {
  basePath: "/admin/users" | "/admin/orders";
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = await getTranslations("admin.pagination");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  return (
    <nav aria-label={t("label")} className="flex items-center justify-between pt-2">
      <Link
        aria-disabled={page <= 1}
        href={{ pathname: basePath, query: { page: String(Math.max(1, page - 1)) } }}
        className={`rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors ${
          page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-primary-900/5"
        }`}
      >
        {t("previous")}
      </Link>
      <span className="text-sm text-muted">
        {t("pageOf", { page, totalPages })}
      </span>
      <Link
        aria-disabled={page >= totalPages}
        href={{ pathname: basePath, query: { page: String(Math.min(totalPages, page + 1)) } }}
        className={`rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors ${
          page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-primary-900/5"
        }`}
      >
        {t("next")}
      </Link>
    </nav>
  );
}
