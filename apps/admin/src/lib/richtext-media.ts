"use client";

import { getStoredSession } from "@/lib/admin-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";
const pendingMediaMap = new Map<string, { file: File; previewUrl: string }>();

function resolveAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_URL}${url}`;
}

function createMediaId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function registerPendingMedia(file: File) {
  const id = createMediaId();
  const previewUrl = URL.createObjectURL(file);
  pendingMediaMap.set(id, { file, previewUrl });
  return { id, previewUrl };
}

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("files", file);

  const session = getStoredSession();
  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: {
      ...(session?.jwt ? { Authorization: `Bearer ${session.jwt}` } : {}),
    },
    body: formData,
  });

  const payload = (await response.json()) as Array<{ url: string }> | { error?: { message?: string } };
  if (!response.ok || !Array.isArray(payload) || !payload[0]?.url) {
    const message =
      !Array.isArray(payload) && payload?.error?.message
        ? payload.error.message
        : "Failed to upload image";
    throw new Error(message);
  }

  return resolveAssetUrl(payload[0].url);
}

export async function resolveRichTextMediaBeforeSave(html: string) {
  if (!html.includes("data-local-media-id")) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll("img"));
  const uploadedMap = new Map<string, string>();

  for (const image of images) {
    const mediaId = image.getAttribute("data-local-media-id") ?? "";
    if (!mediaId) {
      continue;
    }

    let uploadedUrl = uploadedMap.get(mediaId);
    if (!uploadedUrl) {
      const pending = pendingMediaMap.get(mediaId);
      if (!pending) {
        throw new Error("Pending media was lost. Please re-select the image and save again.");
      }

      const { file, previewUrl } = pending;
      uploadedUrl = await uploadImage(file);
      uploadedMap.set(mediaId, uploadedUrl);
      URL.revokeObjectURL(previewUrl);
      pendingMediaMap.delete(mediaId);
    }

    image.setAttribute("src", uploadedUrl);
    image.removeAttribute("data-local-media-id");
  }

  return doc.body.innerHTML;
}
