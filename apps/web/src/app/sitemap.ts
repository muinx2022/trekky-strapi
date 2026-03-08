import type { MetadataRoute } from "next";
import {
  getCategoriesForSitemap,
  getPagesForSitemap,
  getPostsForSitemap,
  getTagsForSitemap,
} from "@/lib/strapi";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, pages] = await Promise.all([
    getPostsForSitemap(),
    getCategoriesForSitemap(),
    getTagsForSitemap(),
    getPagesForSitemap(),
  ]);

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    ...posts
      .filter((post) => post.slug && post.documentId)
      .map((post) => ({
        url: `${SITE_URL}/p/${post.slug}--${post.documentId}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...categories
      .filter((category) => category.slug)
      .map((category) => ({
        url: `${SITE_URL}/c/${category.slug}`,
        lastModified: category.updatedAt ? new Date(category.updatedAt) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...tags
      .filter((tag) => tag.slug)
      .map((tag) => ({
        url: `${SITE_URL}/t/${tag.slug}`,
        lastModified: tag.updatedAt ? new Date(tag.updatedAt) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ...pages
      .filter((page) => page.slug)
      .map((page) => ({
        url: `${SITE_URL}/page/${page.slug}`,
        lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}
