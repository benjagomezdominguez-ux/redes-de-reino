import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireChatAdmin } from "@/lib/supabase/require-auth";
import { listConversationsForAdmin } from "@/lib/admin/chat-queries";
import { AdminChatView } from "@/components/chat/AdminChatView";
import { PushPermissionBanner } from "@/components/chat/PushPermissionBanner";

export default async function AdminChatPage({
  params,
}: PageProps<"/[locale]/admin/chat">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Private to Ariel Gómez specifically — any other admin (even the
  // site's original admin/owner account) is refused, same as a
  // non-admin. See src/lib/chat/is-chat-admin.ts.
  const admin = await requireChatAdmin();
  const conversations = await listConversationsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PushPermissionBanner />
      <Suspense>
        <AdminChatView initialConversations={conversations} adminId={admin.id} />
      </Suspense>
    </div>
  );
}
