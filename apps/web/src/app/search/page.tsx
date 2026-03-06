import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";


type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

type PostHit = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt: string;
};

type TagHit = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
};

type CategoryHit = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
};

type SearchResults = {
  posts: PostHit[];
  tags: TagHit[];
  categories: CategoryHit[];
};

async function fetchSearchResults(q: string): Promise<SearchResults> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/search-proxy?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) return { posts: [], tags: [], categories: [] };
  return res.json();
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() || "";
  return {
    title: query ? `Tìm kiếm: ${query}` : "Tìm kiếm",
    description: query ? `Kết quả tìm kiếm cho "${query}"` : "Tìm kiếm bài viết, tags và danh mục",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  let results: SearchResults = { posts: [], tags: [], categories: [] };
  if (query) {
    results = await fetchSearchResults(query);
  }

  const totalResults = results.posts.length + results.tags.length + results.categories.length;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-6 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          {query ? `Kết quả tìm kiếm` : "Tìm kiếm"}
        </h1>
        {query && (
          <p className="mt-1 text-sm text-zinc-500">
            {totalResults > 0
              ? `${totalResults} kết quả cho "${query}"`
              : `Không tìm thấy kết quả nào cho "${query}"`}
          </p>
        )}
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-800">
            &larr; Về trang chủ
          </Link>
        </div>
      </section>

      {!query && (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-zinc-400">Nhập từ khóa vào ô tìm kiếm để bắt đầu</p>
        </div>
      )}

      {query && totalResults === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-zinc-400">Không tìm thấy kết quả nào phù hợp</p>
        </div>
      )}

      {results.posts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Bài viết ({results.posts.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.posts.map((post) => (
              <li key={post.documentId}>
                <Link
                  href={`/p/${post.slug}--${post.documentId}`}
                  className="block px-5 py-4 transition-colors hover:bg-zinc-50"
                >
                  <p className="font-medium text-zinc-900">{post.title}</p>
                  {post.excerpt && (
                    <div
                      className="mt-1 line-clamp-2 text-sm text-zinc-500 [&_p]:inline"
                      dangerouslySetInnerHTML={{ __html: post.excerpt }}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.tags.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Tags ({results.tags.length})
            </h2>
          </div>
          <ul className="flex flex-wrap gap-2 p-5">
            {results.tags.map((tag) => (
              <li key={tag.documentId}>
                <Link
                  href={`/t/${tag.slug}`}
                  className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  #{tag.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.categories.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Danh mục ({results.categories.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.categories.map((cat) => (
              <li key={cat.documentId}>
                <Link
                  href={`/c/${cat.slug}`}
                  className="block px-5 py-4 transition-colors hover:bg-zinc-50"
                >
                  <p className="font-medium text-zinc-900">{cat.name}</p>
                  {cat.description && (
                    <p className="mt-0.5 text-sm text-zinc-500">{cat.description}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
