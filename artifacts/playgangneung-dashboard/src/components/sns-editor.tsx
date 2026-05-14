import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";

export interface SnsEditorHandle {
  focus: () => void;
  insertText: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

const ToolBtn = ({
  active,
  onMouseDown,
  title,
  children,
}: {
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    onMouseDown={onMouseDown}
    className={`flex items-center justify-center w-7 h-7 rounded text-sm font-bold transition-colors select-none
      ${active
        ? "bg-violet-200 text-violet-900"
        : "bg-transparent text-gray-600 hover:bg-gray-100"
      }`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />;

const SnsEditor = forwardRef<SnsEditorHandle, Props>(
  ({ value, onChange, placeholder = "SNS 문구를 입력하세요.", rows = 7 }, ref) => {
    const lastValue = useRef(value);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          code: false,
          codeBlock: false,
          horizontalRule: false,
          dropcursor: false,
          gapcursor: false,
        }),
      ],
      content: value || "<p></p>",
      onUpdate({ editor: e }) {
        const html = e.getHTML();
        lastValue.current = html;
        onChange(html);
      },
      editorProps: {
        attributes: {
          class: "outline-none min-h-full px-3 py-2 text-sm leading-relaxed",
        },
      },
    });

    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      if (value !== lastValue.current) {
        lastValue.current = value;
        editor.commands.setContent(value || "<p></p>");
      }
    }, [value, editor]);

    useImperativeHandle(ref, () => ({
      focus() { editor?.commands.focus(); },
      insertText(text: string) {
        editor?.chain().focus().insertContent(text).run();
      },
    }));

    const cmd = (fn: () => boolean) => (e: React.MouseEvent) => {
      e.preventDefault();
      fn();
    };

    return (
      <div className="border border-violet-200 rounded-xl overflow-hidden focus-within:border-violet-400 transition-colors bg-white">
        {/* ── 툴바 ── */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-violet-100 bg-violet-50/60">
          <ToolBtn active={editor?.isActive("bold")} title="굵게 (Ctrl+B)"
            onMouseDown={cmd(() => editor?.chain().focus().toggleBold().run() ?? false)}>
            <strong>B</strong>
          </ToolBtn>
          <ToolBtn active={editor?.isActive("italic")} title="기울임 (Ctrl+I)"
            onMouseDown={cmd(() => editor?.chain().focus().toggleItalic().run() ?? false)}>
            <em className="not-italic italic">I</em>
          </ToolBtn>
          <ToolBtn active={editor?.isActive("strike")} title="취소선"
            onMouseDown={cmd(() => editor?.chain().focus().toggleStrike().run() ?? false)}>
            <s>S</s>
          </ToolBtn>

          <Sep />

          <ToolBtn active={editor?.isActive("bulletList")} title="글머리 기호 목록 (•)"
            onMouseDown={cmd(() => editor?.chain().focus().toggleBulletList().run() ?? false)}>
            <span className="text-xs">• 목록</span>
          </ToolBtn>
          <ToolBtn active={editor?.isActive("orderedList")} title="번호 목록 (1.)"
            onMouseDown={cmd(() => editor?.chain().focus().toggleOrderedList().run() ?? false)}>
            <span className="text-xs">1. 목록</span>
          </ToolBtn>

          <Sep />

          <ToolBtn title="되돌리기 (Ctrl+Z)"
            onMouseDown={cmd(() => editor?.chain().focus().undo().run() ?? false)}>
            ↩
          </ToolBtn>
          <ToolBtn title="다시 실행 (Ctrl+Y)"
            onMouseDown={cmd(() => editor?.chain().focus().redo().run() ?? false)}>
            ↪
          </ToolBtn>
        </div>

        {/* ── 편집 영역 ── */}
        <div
          style={{ minHeight: `${rows * 1.75}rem` }}
          className="relative cursor-text"
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:outline-none [&_.tiptap_p]:my-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_li]:my-0.5"
          />
          {editor && !editor.getText() && (
            <span className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
              {placeholder}
            </span>
          )}
        </div>
      </div>
    );
  }
);

SnsEditor.displayName = "SnsEditor";
export default SnsEditor;
