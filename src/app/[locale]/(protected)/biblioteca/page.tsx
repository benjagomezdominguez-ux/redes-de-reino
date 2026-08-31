import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

export default async function LibraryPage({
  params,
}: PageProps<"/[locale]/biblioteca">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.library");

  const supabase = await getSupabaseSessionClient();

  type LibraryEntry = {
    product_id: string;
    products: { title: string | null; author: string | null; cover_url: string | null } | null;
  };
  let entitlements: LibraryEntry[] = [];

  const { data: granted } = await supabase
    .from("digital_entitlements")
    .select("product_id")
    .eq("status", "granted");

  const productIds = (granted ?? []).map((g) => g.product_id);

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, title, author, cover_url")
      .in("id", productIds);

    entitlements = productIds.map((productId) => ({
      product_id: productId,
      products: products?.find((p) => p.id === productId) ?? null,
    }));
  }

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-4xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>

          {entitlements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {t("empty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {entitlements.map((entitlement) => (
                <div
                  key={entitlement.product_id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-surface-alt">
                    {entitlement.products?.cover_url ? (
                      <Image
                        src={entitlement.products.cover_url}
                        alt={entitlement.products.title ?? ""}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <h3 className="font-display text-base font-medium text-primary-900">
                    {entitlement.products?.title}
                  </h3>
                  <p className="text-sm text-muted">{entitlement.products?.author}</p>
                  <span className="text-xs font-semibold uppercase tracking-wide text-success">
                    ✓ {t("purchased")}
                  </span>
                  <a
                    href={`/api/books/${entitlement.product_id}/download`}
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
                  >
                    {t("access")}
                  </a>
                </div>
              ))}
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
