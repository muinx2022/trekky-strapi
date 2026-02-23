import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategoryBySlug, getPostsWithPagination } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";
import { RichTextContent } from "@/components/rich-text-content";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const data = await getPostsWithPagination(1, 10, slug);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      <header className="mb-6 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {category.name}
        </h1>
        {category.description && (
          <div className="prose prose-zinc dark:prose-invert">
            {typeof category.description === 'string' ? (
              <RichTextContent html={category.description} />
            ) : (
              <p>Description format not supported yet</p>
            )}
          </div>
        )}
        
        {category.children && category.children.length > 0 && (
          <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-3">
              Danh mục con
            </h2>
            <div className="flex flex-wrap gap-2">
              {category.children.map((child) => (
                <Link
                  key={child.documentId}
                  href={`/c/${child.slug}`}
                  className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <section>
        <h2 className="text-xl font-bold mb-4">Bài viết trong danh mục</h2>
        <InfinitePosts initialPosts={posts} initialTotal={total} categorySlug={slug} />
      </section>
    </div>
  );
}
