import { getPostsWithPagination, getPageByType } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, homePage] = await Promise.all([
    getPostsWithPagination(1, 10),
    getPageByType("home"),
  ]);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;

  return (
    <div className="space-y-4">
      {homePage && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-6 py-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">{homePage.title}</h1>
          {homePage.content && (
            <div
              className="prose prose-zinc mt-3 max-w-none text-sm text-zinc-700 dark:prose-invert dark:text-zinc-300"
              dangerouslySetInnerHTML={{ __html: homePage.content }}
            />
          )}
        </section>
      )}
      <InfinitePosts initialPosts={posts} initialTotal={total} />
    </div>
  );
}
