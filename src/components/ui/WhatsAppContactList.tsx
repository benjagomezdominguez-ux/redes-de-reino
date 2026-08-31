"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { removeContact } from "@/lib/actions/admin-whatsapp";
import type { WhatsAppContactRow } from "@/lib/admin/whatsapp-queries";

export function WhatsAppContactList({ groupId, contacts }: { groupId: string; contacts: WhatsAppContactRow[] }) {
  const t = useTranslations("admin.whatsapp.groupDetail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (contacts.length === 0) {
    return <p className="text-sm text-muted">{t("noContacts")}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-soft">
      {contacts.map((contact) => (
        <li key={contact.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="text-sm font-medium text-text">{contact.phone_e164}</p>
            {contact.display_name ? <p className="text-xs text-muted">{contact.display_name}</p> : null}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await removeContact(contact.id, groupId);
                router.refresh();
              })
            }
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/5 disabled:opacity-50"
          >
            {t("removeContact")}
          </button>
        </li>
      ))}
    </ul>
  );
}
