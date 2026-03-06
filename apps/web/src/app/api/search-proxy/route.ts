import { NextResponse } from "next/server";
import { MeiliSearch } from "meilisearch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({ posts: [], tags: [], categories: [] });
  }

  const client = new MeiliSearch({
    host: process.env.MEILISEARCH_HOST ?? "http://localhost:7700",
    apiKey: process.env.MEILI_SEARCH_KEY,
  });

  try {
    const [posts, tags, categories] = await Promise.all([
      client.index("posts").search(q, { limit: 10 }),
      client.index("tags").search(q, { limit: 5 }),
      client.index("categories").search(q, { limit: 5 }),
    ]);

    return NextResponse.json({
      posts: posts.hits,
      tags: tags.hits,
      categories: categories.hits,
    });
  } catch (error) {
    console.error("MeiliSearch search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
