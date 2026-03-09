"use client";

import { useEffect, useRef, useState, type ChangeEvent, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import YoutubeExtension from "@tiptap/extension-youtube";
import { Node, mergeAttributes } from "@tiptap/core";
import { Bold, Italic, List, ListOrdered, Quote, Heading2, Camera, Images, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nameContentFile } from "@/lib/media-naming";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customVideo: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

const VideoNode = Node.create({
  name: "customVideo",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes({ controls: true, style: "max-width:100%;border-radius:6px;display:block" }, HTMLAttributes),
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const video = document.createElement("video");
      video.src = node.attrs.src as string;
      video.controls = true;
      video.style.maxWidth = "100%";
      video.style.borderRadius = "6px";
      video.style.display = "block";
      return { dom: video };
    };
  },
  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

type TiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  showToolbar: boolean;
  onMediaPicked?: (blobUrl: string, file: File) => void;
};

export function TiptapEditor({ value, onChange, showToolbar, onMediaPicked }: TiptapEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageSelected, setImageSelected] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      YoutubeExtension.configure({ nocookie: true, modestBranding: true }),
      VideoNode,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-zinc dark:prose-invert focus:outline-none w-full",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;

    const syncSelection = () => {
      setImageSelected(editor.isActive("image"));
    };

    syncSelection();
    editor.on("selectionUpdate", syncSelection);
    editor.on("transaction", syncSelection);

    return () => {
      editor.off("selectionUpdate", syncSelection);
      editor.off("transaction", syncSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!imageMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (e.target instanceof Element && !imageMenuRef.current?.contains(e.target)) {
        setImageMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [imageMenuOpen]);

  useEffect(() => {
    if (!imageModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [imageModalOpen]);

  const handleImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setImageMenuOpen(false);
    setImageModalOpen(false);
    const renamed = nameContentFile(file);
    const blobUrl = URL.createObjectURL(file);
    editor.chain().focus().setImage({ src: blobUrl, alt: renamed.name }).run();
    onMediaPicked?.(blobUrl, renamed);
  };

  const handleVideoPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (videoInputRef.current) videoInputRef.current.value = "";
    const renamed = nameContentFile(file);
    const blobUrl = URL.createObjectURL(file);
    editor.commands.setVideo({ src: blobUrl });
    onMediaPicked?.(blobUrl, renamed);
  };

  const handleYoutubeInsert = () => {
    if (!editor || !youtubeUrl.trim()) return;
    editor.commands.setYoutubeVideo({ src: youtubeUrl.trim() });
    setYoutubeUrl("");
    setYoutubeOpen(false);
  };

  const handleOpenImageChooser = useCallback(() => {
    if (window.innerWidth >= 768) {
      imageInputRef.current?.click();
      return;
    }
    setImageMenuOpen(false);
    setImageModalOpen(true);
  }, []);

  const handlePickFromLibrary = useCallback(() => {
    setImageModalOpen(false);
    imageInputRef.current?.click();
  }, []);

  const handlePickFromCamera = useCallback(() => {
    setImageModalOpen(false);
    cameraInputRef.current?.click();
  }, []);

  const handleRemoveSelectedImage = useCallback(() => {
    if (!editor || !editor.isActive("image")) return;
    editor.chain().focus().deleteSelection().run();
    setImageSelected(false);
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[80px] w-full text-zinc-500 text-sm">Loading editor...</div>;
  }

  return (
    <div className="flex w-full flex-col">
      {showToolbar && (
        <div className="mb-2 space-y-1.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("bold") && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Bold"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("italic") && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Italic"
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("heading", { level: 2 }) && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Heading 2"
            >
              <Heading2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("bulletList") && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Bullet List"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("orderedList") && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Ordered List"
            >
              <ListOrdered size={16} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={cn("rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive("blockquote") && "bg-zinc-100 text-blue-600 dark:bg-zinc-800")}
              title="Quote"
            >
              <Quote size={16} />
            </button>

            <span className="mx-0.5 w-px self-stretch bg-zinc-200 dark:bg-zinc-700" />

            <div className="relative" ref={imageMenuRef}>
              <button
                type="button"
                onClick={handleOpenImageChooser}
                className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800", imageMenuOpen && "bg-zinc-100 dark:bg-zinc-800")}
                title="Insert image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                Anh
              </button>
              {imageMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setImageMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    Chọn từ thiết bị
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setImageMenuOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    className="hidden w-full items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 md:flex"
                  >
                    <Camera size={13} />
                    Dùng máy ảnh
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Insert video"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 8-6 4 6 4V8Z" />
                <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
              </svg>
              Video
            </button>

            <button
              type="button"
              onClick={() => setYoutubeOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                youtubeOpen && "bg-zinc-100 dark:bg-zinc-800",
              )}
              title="Embed YouTube"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                <path d="m10 15 5-3-5-3z" />
              </svg>
              YouTube
            </button>
          </div>

          {youtubeOpen && (
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleYoutubeInsert();
                  }
                  if (e.key === "Escape") {
                    setYoutubeOpen(false);
                    setYoutubeUrl("");
                  }
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-transparent focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                autoFocus
              />
              <button
                type="button"
                onClick={handleYoutubeInsert}
                className="rounded bg-gray-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-600"
              >
                Chen
              </button>
              <button
                type="button"
                onClick={() => {
                  setYoutubeOpen(false);
                  setYoutubeUrl("");
                }}
                className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                x
              </button>
            </div>
          )}
        </div>
      )}

      <div className="h-[340px] overflow-y-auto">
        <EditorContent editor={editor} className="w-full text-sm" />
      </div>

      {imageSelected && (
        <div className="mt-3 flex justify-start">
          <button
            type="button"
            onClick={handleRemoveSelectedImage}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
          >
            <X size={16} />
            Xoa anh da chon
          </button>
        </div>
      )}

      {imageModalOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close image chooser"
            onClick={() => setImageModalOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chen anh</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Chọn cách thêm ảnh vào nội dung</p>
              </div>
              <button
                type="button"
                onClick={() => setImageModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={handlePickFromLibrary}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-4 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Images size={20} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Chọn từ thư viện</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">Mở ảnh có sẵn trên thiết bị</span>
                </span>
              </button>

              <button
                type="button"
                onClick={handlePickFromCamera}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-4 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Camera size={20} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Dùng máy ảnh</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">Chụp ảnh mới rồi chèn vào bài</span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setImageModalOpen(false)}
              className="mt-4 w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImagePick} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoPick} />
    </div>
  );
}
