import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { requireUser } from "@/lib/supabase/require-auth";
import { getOrCreateConversation } from "@/lib/actions/chat";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function ChatPage({
  params,
}: PageProps<"/[locale]/chat">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chat");

  // requireUser() is the layout-level gate for this whole route group
  // (unauthenticated visitors never reach this far — see rule 4: "si el
  // usuario no está autenticado, mostrar invitación para iniciar
  // sesión", which the /login redirect there already handles). Calling
  // it again here just gets the profile.
  const profile = await requireUser();
  const conversation = await getOrCreateConversation();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-12 sm:py-16">
        <Container className="max-w-3xl">
          {conversation ? (
            <ChatWindow
              conversationId={conversation.id}
              currentUserId={profile.id}
              viewerRole="user"
              headerTitle={t("headerTitle")}
              headerSubtitle={t("headerSubtitle")}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {t("errors.generic")}
            </p>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
