import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DevotionalContent, getDevotionalExcerpt } from "./DevotionalContent";

describe("DevotionalContent", () => {
  it("CRITICAL: never renders raw HTML from stored content — a script tag stays literal text, not markup", () => {
    const { container } = render(<DevotionalContent content='<script>alert("xss")</script>' />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<script>alert("xss")</script>');
  });

  it("splits blank-line-separated blocks into separate paragraphs", () => {
    const { container } = render(<DevotionalContent content={"Primer párrafo.\n\nSegundo párrafo."} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("Primer párrafo.");
    expect(paragraphs[1].textContent).toBe("Segundo párrafo.");
  });

  it("renders **bold** and *italic* as real elements, not literal asterisks", () => {
    const { container } = render(<DevotionalContent content="Esto es **importante** y esto es *sutil*." />);
    expect(container.querySelector("strong")?.textContent).toBe("importante");
    expect(container.querySelector("em")?.textContent).toBe("sutil");
    expect(container.textContent).not.toContain("**");
  });

  it("renders '- ' prefixed lines as a real list", () => {
    const { container } = render(<DevotionalContent content={"- Primero\n- Segundo\n- Tercero"} />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[1].textContent).toBe("Segundo");
  });

  it("keeps single line breaks within one paragraph as <br>, not a new paragraph", () => {
    const { container } = render(<DevotionalContent content={"Línea uno\nLínea dos"} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("br")).not.toBeNull();
  });
});

describe("getDevotionalExcerpt", () => {
  it("strips formatting markers instead of showing raw asterisks/dashes", () => {
    const excerpt = getDevotionalExcerpt("**Hola** mundo\n\n- item uno");
    expect(excerpt).not.toContain("*");
    expect(excerpt.startsWith("- ")).toBe(false);
  });

  it("truncates long content with an ellipsis", () => {
    const long = "palabra ".repeat(50);
    const excerpt = getDevotionalExcerpt(long, 20);
    expect(excerpt.length).toBeLessThanOrEqual(21);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("leaves short content untouched", () => {
    expect(getDevotionalExcerpt("Corto")).toBe("Corto");
  });
});
