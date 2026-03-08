import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("Authorization") ?? "";

  const query = new URLSearchParams();
  const targetType = searchParams.get("targetType");
  const targetDocumentId = searchParams.get("targetDocumentId");
  if (targetType) query.set("targetType", targetType);
  if (targetDocumentId) query.set("targetDocumentId", targetDocumentId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/reports/mine?${query.toString()}`, {
      headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ data: { reported: false } });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const body = await request.json();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/reports/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Cannot connect to API" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
