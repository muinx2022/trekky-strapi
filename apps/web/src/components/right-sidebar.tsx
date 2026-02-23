import Link from "next/link";
import { getTopPosts } from "@/lib/strapi";

export async function RightSidebar() {
  const posts = await getTopPosts(10);

  return (
    <div className="flex flex-col gap-0.5">
      {posts && posts.length > 0 ? (
        posts.map((post, index) => (
          <Link
            key={post.documentId}
            href={`/p/${post.slug}--${post.documentId}`}
            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 group transition-colors"
          >
            <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {index + 1}
            </span>
            <h4 className="text-sm leading-snug text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 transition-colors">
              {post.title}
            </h4>
          </Link>
        ))
      ) : (
        <div className="text-sm text-zinc-400 py-2 text-center">Chưa có bài viết</div>
      )}
    </div>
  );
}
