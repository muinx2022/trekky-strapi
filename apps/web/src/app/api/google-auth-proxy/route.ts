import { NextRequest } from "next/server";

const STRAPI_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:1337";

export async function GET(req: NextRequest) {
  const accessToken = req.nextUrl.searchParams.get("access_token");
  if (!accessToken) {
    return Response.json({ error: "Missing access_token" }, { status: 400 });
  }

  const res = await fetch(
    `${STRAPI_URL}/api/auth/google/callback?access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
