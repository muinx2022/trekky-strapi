import { NextResponse } from "next/server";
import { getPostsWithPagination } from "@/lib/strapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const categorySlug = searchParams.get("category") || undefined;
  const tagSlug = searchParams.get("tag") || undefined;
  const authorUsername = searchParams.get("author") || undefined;

  try {
    const data = await getPostsWithPagination(page, pageSize, categorySlug, tagSlug, authorUsername);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch posts", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
