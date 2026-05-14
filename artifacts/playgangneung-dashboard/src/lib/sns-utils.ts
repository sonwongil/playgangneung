function unicodeBold(text: string): string {
  return [...text].map((c) => {
    const code = c.codePointAt(0) ?? 0;
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d400 + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d41a + code - 97);
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ce + code - 48);
    return c;
  }).join("");
}

function nodeToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = () => Array.from(el.childNodes).map(nodeToText).join("");
  if (tag === "strong" || tag === "b") return unicodeBold(inner());
  if (tag === "p") return inner() + "\n";
  if (tag === "br") return "\n";
  if (tag === "li") return "• " + inner() + "\n";
  if (tag === "ul" || tag === "ol") return inner();
  if (tag === "blockquote") return inner() + "\n";
  return inner();
}

/** TipTap HTML → SNS 복사용 plain text (bold → Unicode bold) */
export function htmlToSns(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return nodeToText(div).replace(/\n{3,}/g, "\n\n").trim();
}

/** DB plain text → TipTap 초기 HTML */
export function snsToHtml(text: string): string {
  if (!text) return "<p></p>";
  return text
    .split("\n")
    .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`)
    .join("");
}
