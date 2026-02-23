import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

export async function POST(request: Request) {
  const body = await request.json();
  const authHeader = request.headers.get("Authorization") ?? "";

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ data: body }),
    });
  } catch {
    return NextResponse.json({ error: "Cannot connect to API" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
