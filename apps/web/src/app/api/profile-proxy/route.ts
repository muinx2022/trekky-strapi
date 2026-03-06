import { NextResponse } from "next/server";
import { nameAvatarFile } from "@/lib/media-naming";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type MePayload = {
  id?: number;
  username?: string;
  email?: string;
  bio?: string | null;
  avatar?: unknown;
};

async function resolveCurrentUser(authHeader: string) {
  const meRes = await fetch(`${API_URL}/api/users/me?populate[avatar][fields][0]=url`, {
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const mePayload = (await meRes.json()) as MePayload;
  if (!mePayload.id) {
    return { error: NextResponse.json({ error: "Cannot resolve current user" }, { status: 400 }) };
  }

  return { mePayload };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    return NextResponse.json(resolved.mePayload);
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    const formData = await request.formData();
    const bio = String(formData.get("bio") ?? "").trim();
    const avatarFile = formData.get("avatar");

    const payload: Record<string, unknown> = {
      bio,
    };

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const uploadFormData = new FormData();
      const renamedAvatar = nameAvatarFile(avatarFile);
      uploadFormData.append("files", renamedAvatar, renamedAvatar.name);

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
        body: uploadFormData,
      });

      const uploadPayload = (await uploadRes.json().catch(() => ({}))) as
        | Array<{ id?: number }>
        | { error?: { message?: string }; message?: string };
      if (!uploadRes.ok) {
        const message = Array.isArray(uploadPayload)
          ? "Failed to upload avatar"
          : uploadPayload?.error?.message || uploadPayload?.message || "Failed to upload avatar";
        return NextResponse.json({ error: message }, { status: uploadRes.status });
      }

      const avatarId = Array.isArray(uploadPayload) ? uploadPayload[0]?.id : undefined;
      if (!avatarId) {
        return NextResponse.json({ error: "Failed to resolve uploaded avatar" }, { status: 400 });
      }

      payload.avatar = avatarId;
    }

    const updateRes = await fetch(`${API_URL}/api/users/${resolved.mePayload.id}?populate[avatar][fields][0]=url`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const updatePayload = await updateRes.json().catch(() => ({}));
    if (!updateRes.ok) {
      return NextResponse.json(
        { error: (updatePayload as { error?: { message?: string } })?.error?.message ?? "Update failed" },
        { status: updateRes.status },
      );
    }

    const refreshed = await resolveCurrentUser(authHeader);
    if ("error" in refreshed) {
      return NextResponse.json(updatePayload);
    }

    return NextResponse.json(refreshed.mePayload);
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
