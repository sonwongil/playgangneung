import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface SnsEditorHandle {
  insertText: (text: string) => void;
  applyUnicodeBold: () => void;
  applyFullwidth: () => void;
  applySmall: () => void;
  focus: () => void;
  getCharCount: () => number;
}

interface Props {
  value: string;
  onChange: (plain: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

function plainToHtml(text: string): string {
  if (!text) return "<p></p>";
  return text
    .split("\n")
    .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`)
    .join("");
}

function editorToPlain(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return "";
  const lines: string[] = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name === "paragraph") {
      lines.push(node.textContent);
    }
  });
  return lines.join("\n");
}

const BOLD_MAP: Record<number, number> = {};
for (let i = 0; i < 26; i++) {
  BOLD_MAP[65 + i] = 0x1d400 + i;
  BOLD_MAP[97 + i] = 0x1d41a + i;
}
for (let i = 0; i < 10; i++) BOLD_MAP[48 + i] = 0x1d7ce + i;

const SMALL_MAP: Record<string, string> = {
  a:"ᵃ",b:"ᵇ",c:"ᶜ",d:"ᵈ",e:"ᵉ",f:"ᶠ",g:"ᵍ",h:"ʰ",i:"ⁱ",j:"ʲ",k:"ᵏ",l:"ˡ",m:"ᵐ",n:"ⁿ",o:"ᵒ",p:"ᵖ",q:"q",r:"ʳ",s:"ˢ",t:"ᵗ",u:"ᵘ",v:"ᵛ",w:"ʷ",x:"ˣ",y:"ʸ",z:"ᶻ",
  A:"ᴬ",B:"ᴮ",C:"ᶜ",D:"ᴰ",E:"ᴱ",F:"ᶠ",G:"ᴳ",H:"ᴴ",I:"ᴵ",J:"ᴶ",K:"ᴷ",L:"ᴸ",M:"ᴹ",N:"ᴺ",O:"ᴼ",P:"ᴾ",Q:"Q",R:"ᴿ",S:"ˢ",T:"ᵀ",U:"ᵁ",V:"ⱽ",W:"ᵂ",X:"ˣ",Y:"ʸ",Z:"ᶻ",
};

function transformChars(text: string, type: "bold" | "fullwidth" | "small"): string {
  return [...text].map((c) => {
    const code = c.codePointAt(0) ?? 0;
    if (type === "bold") return BOLD_MAP[code] ? String.fromCodePoint(BOLD_MAP[code]) : c;
    if (type === "fullwidth") return code >= 33 && code <= 126 ? String.fromCodePoint(code + 0xff00 - 0x20) : c;
    if (type === "small") return SMALL_MAP[c] ?? c;
    return c;
  }).join("");
}

const SnsEditor = forwardRef<SnsEditorHandle, Props>(
  ({ value, onChange, placeholder = "SNS 문구를 입력하세요.", className = "", rows = 7 }, ref) => {
    const lastValue = useRef(value);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          bold: false,
          italic: false,
          strike: false,
          code: false,
          codeBlock: false,
          heading: false,
          blockquote: false,
          horizontalRule: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          dropcursor: false,
          gapcursor: false,
        }),
      ],
      content: plainToHtml(value),
      onUpdate({ editor: e }) {
        const plain = editorToPlain(e);
        lastValue.current = plain;
        onChange(plain);
      },
      editorProps: {
        attributes: {
          class: `prose-none outline-none w-full`,
          "data-placeholder": placeholder,
        },
      },
    });

    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      if (value !== lastValue.current) {
        lastValue.current = value;
        editor.commands.setContent(plainToHtml(value));
      }
    }, [value, editor]);

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        editor?.chain().focus().insertContent(text).run();
      },
      applyUnicodeBold() {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to);
        if (!selected) return;
        editor.chain().focus().deleteSelection().insertContent(transformChars(selected, "bold")).run();
      },
      applyFullwidth() {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to);
        if (!selected) return;
        editor.chain().focus().deleteSelection().insertContent(transformChars(selected, "fullwidth")).run();
      },
      applySmall() {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to);
        if (!selected) return;
        editor.chain().focus().deleteSelection().insertContent(transformChars(selected, "small")).run();
      },
      focus() {
        editor?.commands.focus();
      },
      getCharCount() {
        return editor ? editorToPlain(editor).length : 0;
      },
    }));

    const minHeight = `${rows * 1.625}rem`;

    return (
      <div
        className={`relative w-full rounded-b-xl border border-violet-200 focus-within:border-violet-400 bg-white transition-colors overflow-auto ${className}`}
        style={{ minHeight }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent
          editor={editor}
          className="w-full h-full text-sm px-3 py-2 [&_.tiptap]:outline-none [&_.tiptap]:min-h-full [&_.tiptap_p]:min-h-[1.5em] [&_.tiptap_p]:my-0 [&_.tiptap_p:empty::before]:content-[attr(data-placeholder)] [&_.tiptap_p:empty::before]:text-muted-foreground [&_.tiptap_p:empty::before]:pointer-events-none"
        />
        {editor && !editorToPlain(editor) && (
          <span className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </span>
        )}
      </div>
    );
  }
);

SnsEditor.displayName = "SnsEditor";
export default SnsEditor;
