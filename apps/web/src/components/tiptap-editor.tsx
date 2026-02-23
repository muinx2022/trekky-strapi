"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote, Heading2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  showToolbar: boolean;
};

export function TiptapEditor({ value, onChange, showToolbar }: TiptapEditorProps) {
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-zinc dark:prose-invert focus:outline-none min-h-[80px] w-full",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!mounted || !editor) {
    return <div className="min-h-[80px] w-full text-zinc-500 text-sm">Loading editor...</div>;
  }

  return (
    <div className="w-full flex flex-col">
      {showToolbar && (
        <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("bold") && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("italic") && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("heading", { level: 2 }) && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("bulletList") && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("orderedList") && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Ordered List"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("blockquote") && "bg-zinc-100 dark:bg-zinc-800 text-blue-600")}
            title="Quote"
          >
            <Quote size={16} />
          </button>
        </div>
      )}
      <EditorContent editor={editor} className="w-full text-sm" />
    </div>
  );
}
