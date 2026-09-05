import type { ReactNode } from "react";

// A small, deliberately-limited safe formatter — never HTML, never
// dangerouslySetInnerHTML. Every node here is a real React element built
// directly from the plain-text content, so there is no way for stored
// content to inject markup: React escapes everything it doesn't
// explicitly turn into an element itself.
//
// Supports: paragraphs (blank-line separated), single line breaks within
// a paragraph, **bold**, *italic*, and "- " prefixed lists.

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  INLINE_TOKEN.lastIndex = 0;
  while ((match = INLINE_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = INLINE_TOKEN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Plain-text preview for library cards — strips the same lightweight
// markers DevotionalContent understands (**bold**, *italic*, "- " list
// markers) rather than showing the raw asterisks/dashes in a summary.
export function getDevotionalExcerpt(content: string, maxLength = 180): string {
  const flattened = content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return flattened.length > maxLength ? `${flattened.slice(0, maxLength).trimEnd()}…` : flattened;
}

export function DevotionalContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim().length > 0);

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const isList = lines.length > 0 && lines.every((line) => line.trim().startsWith("- "));

        if (isList) {
          return (
            <ul key={blockIndex} className="list-disc space-y-1.5 pl-6">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{parseInline(line.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {parseInline(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
