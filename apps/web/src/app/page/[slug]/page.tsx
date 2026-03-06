import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/strapi";
import { RichTextWithLightbox } from "@/components/rich-text-with-lightbox";
import { SITE_URL, SITE_NAME, stripHtml, truncate, buildOgImages } from "@/lib/seo";

export const dynamic = "force-dynamic";

type StaticPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: StaticPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};

  const description = page.content
    ? truncate(stripHtml(page.content), 160)
    : `${page.title} – ${SITE_NAME}`;
  const canonical = `${SITE_URL}/page/${slug}`;

  return {
    title: page.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: page.title,
      description,
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: buildOgImages(undefined),
    },
    twitter: {
      card: "summary",
      title: page.title,
      description,
    },
  };
}

export default async function StaticPage({ params }: StaticPageProps) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
      </div>
      <div className="px-6 py-6">
        <RichTextWithLightbox
          html={page.content ?? ""}
          className="prose prose-sm max-w-none text-gray-700 [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_video]:h-auto [&_video]:max-w-full"
        />
      </div>
    </article>
  );
}
