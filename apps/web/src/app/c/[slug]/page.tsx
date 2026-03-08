import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryBySlug, getPostsWithPagination } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";
import { RichTextContent } from "@/components/rich-text-content";
import { SITE_URL, SITE_NAME, stripHtml, truncate, buildOgImages } from "@/lib/seo";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};

  const description = category.description
    ? truncate(stripHtml(category.description), 160)
    : `Bài viết trong danh mục ${category.name} trên ${SITE_NAME}.`;
  const canonical = `${SITE_URL}/c/${slug}`;

  return {
    title: category.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: category.name,
      description,
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: buildOgImages(undefined),
    },
    twitter: {
      card: "summary",
      title: category.name,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const data = await getPostsWithPagination(1, 10, slug);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{category.name}</h1>

        {category.description && (
          <div className="prose prose-sm mt-3 max-w-none text-gray-700 dark:text-gray-300">
            {typeof category.description === "string" ? (
              <RichTextContent html={category.description} />
            ) : (
              <p>Description format not supported yet</p>
            )}
          </div>
        )}

        {category.children && category.children.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Danh mục con</h2>
            <div className="flex flex-wrap gap-2">
              {category.children.map((child) => (
                <Link
                  key={child.documentId}
                  href={`/c/${child.slug}`}
                  className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <InfinitePosts initialPosts={posts} initialTotal={total} categorySlug={slug} />
      </section>
    </div>
  );
}
