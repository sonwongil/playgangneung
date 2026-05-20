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
  if (tag === "a") {
    // <a> 태그는 링크 텍스트만 반환 (URL 제외 — 복사 텍스트에서도 URL 숨김)
    return inner();
  }
  return inner();
}

/** TipTap HTML → SNS 복사용 plain text (bold → Unicode bold) */
export function htmlToSns(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return nodeToText(div).replace(/\n{3,}/g, "\n\n").trim();
}

/** HTML 엔티티 디코딩 (크롤러에서 저장된 &nbsp; 등 처리) */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ");
}

/** DB plain text → TipTap 초기 HTML
 *  - HTML 엔티티(&nbsp; 등) 자동 디코딩
 *  - "🔗 자세히 보기 → https://..." 패턴은 <a> 하이퍼링크로 변환 (URL 숨김)
 */
export function snsToHtml(text: string): string {
  if (!text) return "<p></p>";
  const decoded = decodeEntities(text);
  return decoded
    .split("\n")
    .map((l) => {
      // "🔗 자세히 보기 → URL" 패턴 → <a> 링크 (URL 숨김)
      const linkMatch = l.match(/^(.*?)🔗\s*자세히 보기\s*→\s*(https?:\/\/\S+)\s*$/);
      if (linkMatch) {
        const prefix = linkMatch[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const url = linkMatch[2];
        return `<p>${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">🔗 자세히 보기</a></p>`;
      }
      const escaped = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<p>${escaped || "<br>"}</p>`;
    })
    .join("");
}
