import Link from "next/link";
import { RichTextContent } from "@/components/rich-text-content";
import { Post } from "@/lib/strapi";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function extractFirstMedia(content: string) {
  if (!content) {
    return null;
  }

  const videoMatch = content.match(/<(video|iframe)\b[^>]*>[\s\S]*?<\/\1>|<(video|iframe)\b[^>]*\/?\s*>/i);
  if (videoMatch?.[0]) {
    return { type: "video" as const, html: videoMatch[0] };
  }

  const imageMatch = content.match(/<img\b[^>]*\/?\s*>/i);
  if (imageMatch?.[0]) {
    return { type: "image" as const, html: imageMatch[0] };
  }

  return null;
}

function htmlExcerptByWords(html: string, limit = 100) {
  if (!html) {
    return "";
  }

  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  const openTags: string[] = [];
  let words = 0;
  let reachedLimit = false;
  let result = "";

  for (const token of tokens) {
    if (reachedLimit) {
      break;
    }

    if (token.startsWith("<")) {
      const closing = token.match(/^<\s*\/\s*([a-zA-Z0-9-]+)/);
      if (closing) {
        const tagName = closing[1].toLowerCase();
        const stackIndex = openTags.lastIndexOf(tagName);
        if (stackIndex >= 0) {
          openTags.splice(stackIndex, 1);
          result += token;
        }
        continue;
      }

      const opening = token.match(/^<\s*([a-zA-Z0-9-]+)/);
      if (opening) {
        const tagName = opening[1].toLowerCase();
        result += token;
        if (!VOID_TAGS.has(tagName) && !/\/>\s*$/.test(token)) {
          openTags.push(tagName);
        }
      }
      continue;
    }

    const parts = token.match(/\S+|\s+/g) ?? [];
    let textChunk = "";

    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        textChunk += part;
        continue;
      }

      if (words >= limit) {
        reachedLimit = true;
        break;
      }

      textChunk += part;
      words += 1;
    }

    result += textChunk;

    if (reachedLimit) {
      result = result.trimEnd() + "...";
    }
  }

  for (let i = openTags.length - 1; i >= 0; i -= 1) {
    result += `</${openTags[i]}>`;
  }

  return result;
}

export function PostCard({ post }: { post: Post }) {
  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const mediaPreview = extractFirstMedia(post.content);
  const contentPreview = !mediaPreview ? htmlExcerptByWords(post.content, 100) : "";

  return (
    <article className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(post.categories ?? []).map((category) => (
            <Link
              key={category.documentId}
              href={`/c/${category.slug}`}
              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/40"
            >
              {category.name}
            </Link>
          ))}
        </div>
        {formattedDate && (
          <span className="mt-0.5 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formattedDate}</span>
        )}
      </div>

      <Link
        href={`/p/${post.slug}--${post.documentId}`}
        className="block text-xl font-semibold leading-snug text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400"
      >
        {post.title}
      </Link>

      {mediaPreview ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
          <RichTextContent
            html={mediaPreview.html}
            className="[&>iframe]:aspect-video [&>iframe]:h-auto [&>iframe]:w-full [&>img]:h-auto [&>img]:w-full [&>video]:h-auto [&>video]:w-full"
          />
        </div>
      ) : contentPreview ? (
        <div className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          <RichTextContent html={contentPreview} />
        </div>
      ) : post.excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {post.excerpt}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Binh luan ({post.commentsCount ?? 0})
          </span>
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            Thich ({post.likesCount ?? 0})
          </span>
        </div>
        <Link
          href={`/p/${post.slug}--${post.documentId}`}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Doc them -&gt;
        </Link>
      </div>
    </article>
  );
}
