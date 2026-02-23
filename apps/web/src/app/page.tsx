import { getPostsWithPagination } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getPostsWithPagination(1, 10);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Bài viết mới nhất
        </h1>
        <p className="mt-2 text-zinc-600">
          Cập nhật những thông tin và bài viết mới nhất từ chúng tôi.
        </p>
      </header>

      <section>
        <InfinitePosts initialPosts={posts} initialTotal={total} />
      </section>
    </div>
  );
}
