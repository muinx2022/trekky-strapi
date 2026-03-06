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
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-6 py-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">{category.name}</h1>

        {category.description && (
          <div className="prose prose-zinc mt-3 max-w-none text-sm text-zinc-700 dark:prose-invert dark:text-zinc-300">
            {typeof category.description === "string" ? (
              <RichTextContent html={category.description} />
            ) : (
              <p>Description format not supported yet</p>
            )}
          </div>
        )}

        {category.children && category.children.length > 0 && (
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Danh mục con</h2>
            <div className="flex flex-wrap gap-2">
              {category.children.map((child) => (
                <Link
                  key={child.documentId}
                  href={`/c/${child.slug}`}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
