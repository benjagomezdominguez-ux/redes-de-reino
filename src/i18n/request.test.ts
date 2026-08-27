import { describe, expect, it, vi } from "vitest";
import { withSpanishFallback } from "./request";

describe("withSpanishFallback", () => {
  it("keeps translated values when present in both locales", () => {
    const es = { hero: { title: "Hola" } };
    const en = { hero: { title: "Hello" } };

    expect(withSpanishFallback(es, en)).toEqual({ hero: { title: "Hello" } });
  });

  it("falls back to Spanish for a missing top-level key", () => {
    const es = { hero: { title: "Hola" }, footer: { rights: "Todos los derechos" } };
    const en = { hero: { title: "Hello" } };

    expect(withSpanishFallback(es, en)).toEqual({
      hero: { title: "Hello" },
      footer: { rights: "Todos los derechos" },
    });
  });

  it("falls back to Spanish for a missing nested key without dropping siblings", () => {
    const es = {
      contact: { form: { submit: "Enviar", errors: { generic: "Revisá los datos" } } },
    };
    const en = { contact: { form: { submit: "Send" } } };

    expect(withSpanishFallback(es, en)).toEqual({
      contact: {
        form: { submit: "Send", errors: { generic: "Revisá los datos" } },
      },
    });
  });

  it("never produces undefined/null/missing-key placeholders for the caller to render", () => {
    const es = { a: { b: { c: "valor" } } };
    const en = {};

    const result = withSpanishFallback(es, en) as { a: { b: { c: string } } };
    expect(result.a.b.c).toBe("valor");
    expect(result.a.b.c).not.toMatch(/undefined|null|missing/i);
  });

  it("logs a warning in development when a key is missing", () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-expect-error -- test-only override of a readonly-typed env var
    process.env.NODE_ENV = "development";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    withSpanishFallback({ hero: { title: "Hola" } }, {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("hero.title"));

    warnSpy.mockRestore();
    // @ts-expect-error -- restoring the test-only override above
    process.env.NODE_ENV = originalEnv;
  });
});
