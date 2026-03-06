import { NextRequest } from "next/server";

const STRAPI_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:1337";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(
    `${STRAPI_URL}/api/users/me?populate[avatar][fields][0]=url`,
    { headers: { Authorization: auth }, cache: "no-store" }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
