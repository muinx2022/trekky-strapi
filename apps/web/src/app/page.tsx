import type { Metadata } from "next";
import { InfinitePosts } from "@/components/infinite-posts";
import { getPageByType, getPostsWithPagination } from "@/lib/strapi";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, stripHtml, truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await getPageByType("home");
  const homeDescription = homePage?.content ? truncate(stripHtml(homePage.content), 160) : "";
  const description =
    homeDescription.length >= 80 && !/^welcome\b/i.test(homeDescription)
      ? homeDescription
      : SITE_DESCRIPTION;

  return {
    title: SITE_TITLE,
    description,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      type: "website",
      url: SITE_URL,
      title: SITE_TITLE,
      description,
      siteName: SITE_NAME,
      locale: "vi_VN",
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description,
    },
  };
}

export default async function HomePage() {
  const [data, homePage] = await Promise.all([getPostsWithPagination(1, 10), getPageByType("home")]);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "vi-VN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {homePage && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">{homePage.title}</h1>
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
