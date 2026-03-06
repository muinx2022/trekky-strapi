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
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-6 py-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">#{tag.name}</h1>

        {tag.description && (
          <div className="prose prose-zinc mt-3 max-w-none text-sm text-zinc-700 dark:prose-invert dark:text-zinc-300">
            {typeof tag.description === "string" ? (
              <RichTextContent html={tag.description} />
            ) : (
              <p>Description format not supported yet</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
