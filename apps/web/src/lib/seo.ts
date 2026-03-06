const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trekky.net";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:1337" : "https://api.trekky.net");

export const SITE_NAME = "Trekky";
export const SITE_DESCRIPTION =
  "Nền tảng chia sẻ bài viết, kết nối cộng đồng – Đam mê, trải nghiệm, góc nhìn của riêng bạn.";

export { SITE_URL };

/** Convert a possibly-relative Strapi media URL to absolute. */
export function toAbsoluteMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

/** Strip HTML tags and collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate to max chars, appending ellipsis if needed. */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/** Extract the first image URL from an HTML string (for og:image fallback). */
export function extractFirstImageFromHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return undefined;
  const src = match[1];
  return src.startsWith("http") ? src : `${API_URL}${src}`;
}

/** Build the og:image array for Next.js metadata. */
export function buildOgImages(
  imageUrl?: string | null,
  alt?: string | null
): Array<{ url: string; width?: number; height?: number; alt?: string }> {
  if (!imageUrl) return [];
  return [{ url: imageUrl, width: 1200, height: 630, alt: alt ?? SITE_NAME }];
}
