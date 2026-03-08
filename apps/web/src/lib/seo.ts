const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trekky.net";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:1337" : "https://api.trekky.net");

export const SITE_NAME = "Trekky";
export const SITE_TITLE = `${SITE_NAME} - Chia sẻ đam mê, trải nghiệm và góc nhìn riêng`;
export const SITE_DESCRIPTION =
  "Trekky.net là nơi chia sẻ đam mê, trải nghiệm và góc nhìn riêng, kết nối những người sống hết mình và muốn lan tỏa điều tích cực.";
export const SITE_KEYWORDS = [
  "Trekky",
  "mạng xã hội chia sẻ",
  "cộng đồng",
  "bài viết",
  "trải nghiệm",
  "đam mê",
  "góc nhìn riêng",
  "kể chuyện thật",
  "du lịch",
  "khám phá",
];
export const TWITTER_HANDLE = "@trekkynet";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export { SITE_URL };

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

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
  return `${text.slice(0, max - 1).trimEnd()}…`;
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
  const resolvedUrl = imageUrl ?? absoluteUrl(DEFAULT_OG_IMAGE);
  return [{ url: resolvedUrl, width: 1200, height: 630, alt: alt ?? SITE_NAME }];
}
