import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/interactions/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Cannot connect to API" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType") ?? "";
  const targetDocumentId = searchParams.get("targetDocumentId") ?? "";
  const authHeader = request.headers.get("Authorization") ?? "";

  // Load counts (no auth required)
  let likesCount = 0;
  let followsCount = 0;
  if (targetType && targetDocumentId) {
    try {
      const countsRes = await fetch(
        `${API_URL}/api/interactions/counts?targetType=${encodeURIComponent(targetType)}&targetDocumentIds[0]=${encodeURIComponent(targetDocumentId)}`,
        { cache: "no-store" },
      );
      if (countsRes.ok) {
        const countsData = await countsRes.json();
        likesCount = countsData?.data?.likes?.[targetDocumentId] ?? 0;
        followsCount = countsData?.data?.follows?.[targetDocumentId] ?? 0;
      }
    } catch { /* ignore */ }
  }

  if (!authHeader || !targetType) {
    return NextResponse.json({ liked: false, followed: false, likesCount, followsCount });
  }

  let query = `/api/interactions/mine?targetType=${encodeURIComponent(targetType)}`;
  if (targetDocumentId) {
    query += `&targetDocumentId=${encodeURIComponent(targetDocumentId)}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${query}`, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ liked: false, followed: false, likesCount, followsCount });
  }

  if (!res.ok) {
    return NextResponse.json({ liked: false, followed: false, likesCount, followsCount });
  }

  const data = await res.json();
  const interactions: { actionType: string; targetDocumentId?: string }[] = data?.data ?? [];

  if (!targetDocumentId) {
    return NextResponse.json({ data: interactions, likesCount, followsCount });
  }

  return NextResponse.json({
    liked: interactions.some((i) => i.actionType === "like"),
    followed: interactions.some((i) => i.actionType === "follow"),
    likesCount,
    followsCount,
  });
}
