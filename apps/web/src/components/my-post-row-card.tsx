import Link from "next/link";
import { Post } from "@/lib/strapi";

type MyPostRow = Post & {
  status?: "draft" | "published";
};

export function MyPostRowCard({ post }: { post: MyPostRow }) {
  const isPublished = post.status === "published" || Boolean(post.publishedAt);
  const categories = post.categories ?? [];
  const tags = post.tags ?? [];

  return (
    <div>
      {categories.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {categories.slice(0, 3).map((category) => (
            <span
              key={category.documentId}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
            >
              {category.name}
            </span>
          ))}
          {categories.length > 3 && (
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              +{categories.length - 3}
            </span>
          )}
        </div>
      )}

      <Link
        href={`/p/${post.slug}--${post.documentId}`}
        className="block text-xl font-semibold leading-snug text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400"
      >
        {post.title}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isPublished
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isPublished ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
            }`}
          />
          {isPublished ? "Đã xuất bản" : "Bản nháp"}
        </span>
        {tags.map((tag) => (
          <Link
            key={tag.documentId}
            href={`/t/${tag.slug}`}
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            #{tag.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
