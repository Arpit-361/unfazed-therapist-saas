import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2 } from 'lucide-react';

function ToolbarButton({ onClick, active, label, icon: Icon, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition disabled:opacity-40 ${active ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Freeform rich-text note editor (TipTap). Emits sanitized-on-server HTML. */
export default function NoteEditor({ value, onChange, placeholder = 'Start writing your session note...' }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, underline: false })],
    content: value || '',
    editorProps: {
      attributes: { class: 'tiptap prose-note px-4 py-3', 'data-placeholder': placeholder },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === '' && editor.isEmpty)) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return <div className="input min-h-[260px]" />;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5">
        <ToolbarButton label="Bold" icon={Bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton label="Italic" icon={Italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="Strikethrough" icon={Strikethrough} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="mx-1 w-px bg-slate-200" />
        <ToolbarButton label="Heading" icon={Heading2} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="Bullet list" icon={List} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Numbered list" icon={ListOrdered} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton label="Quote" icon={Quote} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <span className="mx-1 w-px bg-slate-200" />
        <ToolbarButton label="Undo" icon={Undo2} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton label="Redo" icon={Redo2} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
