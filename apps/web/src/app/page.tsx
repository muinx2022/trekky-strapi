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
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{homePage.title}</h1>
          {homePage.content && (
            <div
              className="prose prose-sm mt-3 max-w-none text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: homePage.content }}
            />
          )}
        </section>
      )}
      <InfinitePosts initialPosts={posts} initialTotal={total} />
    </div>
  );
}
