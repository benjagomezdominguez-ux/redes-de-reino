import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { CheckoutView } from "@/components/ui/CheckoutView";
import { isOnlinePaymentConfigured } from "@/lib/payments/provider";

export default async function CheckoutPage({
  params,
}: PageProps<"/[locale]/libros/checkout">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.checkout");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-5xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>
          <CheckoutView onlinePaymentAvailable={isOnlinePaymentConfigured()} />
        </Container>
      </main>
      <Footer />
    </>
  );
}
