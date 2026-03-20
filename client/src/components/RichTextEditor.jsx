import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import './RichTextEditor.css';

const COLORS = [
  '#ffffff', '#e2e8f0', '#94a3b8', '#475569', '#1e293b',
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399',
  '#60a5fa', '#818cf8', '#a78bfa', '#f472b6', '#e879f9',
];

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`rte-btn${active ? ' rte-btn--active' : ''}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, disabled }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { spellcheck: 'false' } } }),
      TextStyle,
      Color,
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const setColor = (color) => editor.chain().focus().setColor(color).run();

  return (
    <div className={`rte-wrapper${disabled ? ' rte-wrapper--disabled' : ''}`}>
      {/* ── Toolbar ── */}
      <div className="rte-toolbar">
        {/* Heading */}
        <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Đoạn văn">P</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })} title="Heading 4">H4</ToolbarBtn>

        <span className="rte-sep" />

        {/* Format */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="In đậm (Ctrl+B)"><b>B</b></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="In nghiêng (Ctrl+I)"><i>I</i></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">`c`</ToolbarBtn>

        <span className="rte-sep" />

        {/* Lists */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Danh sách không thứ tự">• —</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Danh sách thứ tự">1.</ToolbarBtn>

        <span className="rte-sep" />

        {/* Block */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Trích dẫn">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Khối code">{'{}'}</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Kẻ ngang">—</ToolbarBtn>

        <span className="rte-sep" />

        {/* Color picker */}
        <div className="rte-color-wrap" title="Màu chữ">
          <div className="rte-color-preview" style={{ background: editor.getAttributes('textStyle').color || 'var(--text-primary)' }} />
          <div className="rte-color-swatches">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                onMouseDown={e => { e.preventDefault(); setColor(c); }}
                className="rte-swatch"
                style={{ background: c }}
              />
            ))}
            <button
              type="button"
              title="Bỏ màu"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
              className="rte-swatch rte-swatch--reset"
            >✕</button>
          </div>
        </div>
      </div>

      {/* ── Editor area ── */}
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
