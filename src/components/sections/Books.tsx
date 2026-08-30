import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BookCard } from "@/components/ui/BookCard";
import { getActiveProducts } from "@/lib/books/queries";

export async function Books() {
  const t = await getTranslations("books");
  const products = await getActiveProducts();

  return (
    <section id="libros" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
            {t("emptyCatalog")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <BookCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
