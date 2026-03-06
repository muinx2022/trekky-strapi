import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const uploadRes = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });

    const payload = await uploadRes.json().catch(() => ([]));

    if (!uploadRes.ok) {
      const message = Array.isArray(payload)
        ? "Upload failed"
        : (payload as { error?: { message?: string }; message?: string })?.error?.message ||
          (payload as { message?: string })?.message ||
          "Upload failed";
      return NextResponse.json({ error: message }, { status: uploadRes.status });
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[upload-proxy] Error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
