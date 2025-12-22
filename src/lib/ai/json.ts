import "server-only";

export function extractFirstJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  let start = -1;
  let open: "{" | "[" | null = null;

  if (firstBrace === -1 && firstBracket === -1) return null;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    open = "{";
  } else {
    start = firstBracket;
    open = "[";
  }

  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) depth--;

    if (depth === 0) {
      return trimmed.slice(start, i + 1);
    }
  }

  return null;
}

