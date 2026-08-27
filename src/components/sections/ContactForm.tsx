"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContactForm, type ContactFormState } from "@/lib/actions/contact";

const initialState: ContactFormState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitContactForm,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-8 shadow-soft"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          Nombre
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            autoComplete="name"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          Email
          <input
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          Teléfono (opcional)
          <input
            type="tel"
            name="phone"
            maxLength={40}
            autoComplete="tel"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          Motivo
          <select name="interest" defaultValue="contacto_general" className={inputClasses}>
            <option value="contacto_general">Consulta general</option>
            <option value="membresia">Quiero ser miembro</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        Mensaje (opcional)
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          className={inputClasses}
        />
      </label>

      {/* Honeypot — hidden from real visitors, catches simple bots */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar mensaje"}
      </button>

      <div role="status" aria-live="polite">
        {state.status === "success" ? (
          <p className="text-sm font-medium text-success">
            ¡Gracias! Recibimos tu mensaje y te vamos a contactar pronto.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-sm font-medium text-error">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
