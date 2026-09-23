import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { AuthForm } from "@/components/ui/AuthForm";
import { Reveal } from "@/components/ui/Reveal";

export default async function SignupPage({
  params,
  searchParams,
}: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-md">
          <Reveal className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <h1 className="mb-6 text-center font-display text-2xl font-medium text-primary-900">
              {t("signupTitle")}
            </h1>
            <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} />
          </Reveal>
        </Container>
      </main>
      <Footer />
    </>
  );
}
