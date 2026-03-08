import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPostsWithPagination, getTagBySlug } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";
import { RichTextContent } from "@/components/rich-text-content";
import { SITE_URL, SITE_NAME, stripHtml, truncate, buildOgImages } from "@/lib/seo";

export const dynamic = "force-dynamic";

type TagPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};

  const description = tag.description
    ? truncate(stripHtml(tag.description), 160)
    : `Bài viết được gắn thẻ #${tag.name} trên ${SITE_NAME}.`;
  const canonical = `${SITE_URL}/t/${slug}`;

  return {
    title: `#${tag.name}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `#${tag.name}`,
      description,
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: buildOgImages(undefined),
    },
    twitter: {
      card: "summary",
      title: `#${tag.name}`,
      description,
    },
  };
}

export default async function TagPage({
  params,
}: TagPageProps) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);

  if (!tag) {
    notFound();
  }

  const data = await getPostsWithPagination(1, 10, undefined, slug);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">#{tag.name}</h1>

        {tag.description && (
          <div className="prose prose-sm mt-3 max-w-none text-gray-700 dark:text-gray-300">
            {typeof tag.description === "string" ? (
              <RichTextContent html={tag.description} />
            ) : (
              <p>Description format not supported yet</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Link
            href="/"
            className="text-sm text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            &larr; Về trang chủ
          </Link>
        </div>
      </section>

      <section>
        <InfinitePosts initialPosts={posts} initialTotal={total} tagSlug={slug} />
      </section>
    </div>
  );
}
