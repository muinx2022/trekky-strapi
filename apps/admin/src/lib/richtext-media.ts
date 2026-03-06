"use client";

import { processVideo, resizeToMaxWidth, uploadMediaFiles } from "@/lib/post-media";

const API_URL = "";
const pendingMediaMap = new Map<string, File>();

function resolveAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_URL}${url}`;
}

export function registerPendingMedia(blobUrl: string, file: File) {
  pendingMediaMap.set(blobUrl, file);
}

export async function resolveRichTextMediaBeforeSave(html: string) {
  if (!html.includes("blob:")) {
    return html;
  }

  let nextHtml = html;
  const blobUrls = [...new Set([...nextHtml.matchAll(/blob:[^"'\s)>]+/g)].map((match) => match[0]))];
  if (blobUrls.length === 0) {
    return html;
  }

  const mediaEntries = blobUrls
    .map((blobUrl) => [blobUrl, pendingMediaMap.get(blobUrl)] as const)
    .filter((entry): entry is readonly [string, File] => !!entry[1]);

  if (mediaEntries.length === 0) {
    return html;
  }

  const processedFiles = await Promise.all(
    mediaEntries.map(async ([, file]) => {
      if (file.type.startsWith("image/")) {
        return resizeToMaxWidth(file);
      }
      if (file.type.startsWith("video/")) {
        return processVideo(file);
      }
      return file;
    }),
  );

  const uploaded = await uploadMediaFiles<{ url?: string }>(processedFiles);

  for (let index = 0; index < mediaEntries.length; index += 1) {
    const [blobUrl] = mediaEntries[index];
    const resolvedUrl = uploaded[index]?.url;
    if (!resolvedUrl) {
      continue;
    }

    nextHtml = nextHtml.replaceAll(blobUrl, resolveAssetUrl(resolvedUrl));
    pendingMediaMap.delete(blobUrl);
    URL.revokeObjectURL(blobUrl);
  }

  return nextHtml;
}
