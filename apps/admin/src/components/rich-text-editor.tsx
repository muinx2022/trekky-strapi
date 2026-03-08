"use client";

import { ChangeEvent, useEffect, useRef } from "react";
import Image from "@tiptap/extension-image";
import YoutubeExtension from "@tiptap/extension-youtube";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, ImagePlus, Italic, List, ListOrdered, Redo2, Undo2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerPendingMedia } from "@/lib/richtext-media";
import { nameContentFile } from "@/lib/media-naming";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  onBlur,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      YoutubeExtension.configure({
        controls: true,
        nocookie: true,
        width: 640,
        height: 360,
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "tiptap h-[420px] overflow-y-auto rounded-md px-3 py-2 text-sm focus:outline-none md:h-[520px]",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
    onBlur: () => onBlur?.(),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  const onUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !editor) {
      return;
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    const renamed = nameContentFile(file);
    const blobUrl = URL.createObjectURL(renamed);
    registerPendingMedia(blobUrl, renamed);
    editor.chain().focus().setImage({ src: blobUrl, alt: renamed.name }).run();
  };

  const onEmbedYoutube = () => {
    if (!editor) {
      return;
    }

    const url = prompt("YouTube URL");
    if (!url?.trim()) {
      return;
    }

    editor.commands.setYoutubeVideo({ src: url.trim() });
  };

  if (!editor) {
    return <div className="rounded-md border p-3 text-sm text-muted-foreground">Loading editor...</div>;
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <div className="flex flex-wrap gap-2 border-b p-2">
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("bold") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          title="Bold"
        >
          <Bold />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("italic") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          title="Italic"
        >
          <Italic />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
          title="Heading 2"
        >
          <Heading2 />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("bulletList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          title="Bullet list"
        >
          <List />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("orderedList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Ordered list"
          title="Ordered list"
        >
          <ListOrdered />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload image"
          title="Upload image"
        >
          <ImagePlus />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={onEmbedYoutube}
          aria-label="Embed YouTube"
          title="Embed YouTube"
        >
          <Youtube />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => editor.chain().focus().undo().run()}
          aria-label="Undo"
          title="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <Undo2 />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => editor.chain().focus().redo().run()}
          aria-label="Redo"
          title="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <Redo2 />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUploadImage}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onUploadImage}
        />
      </div>
      <EditorContent editor={editor} className="max-h-[520px] overflow-hidden" />
    </div>
  );
}
