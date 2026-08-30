import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { CartView } from "@/components/ui/CartView";

export default async function CartPage({
  params,
}: PageProps<"/[locale]/libros/carrito">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.cart");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-3xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>
          <CartView />
        </Container>
      </main>
      <Footer />
    </>
  );
}
