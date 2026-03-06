"use client";

import { getStoredSession } from "@/lib/admin-auth";

export const MAX_WIDTH = 1280;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
export const MAX_VIDEO_WIDTH = 1280;
export const MAX_VIDEO_DURATION = 60;

const API_URL = "";

export async function resizeToMaxWidth(file: File, maxWidth = MAX_WIDTH): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const needsResize = img.naturalWidth > maxWidth;
      const width = needsResize ? maxWidth : img.naturalWidth;
      const height = needsResize
        ? Math.round(img.naturalHeight * (maxWidth / img.naturalWidth))
        : img.naturalHeight;
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? 0.85 : undefined;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          if (blob.size >= file.size && !needsResize) {
            resolve(file);
            return;
          }
          const ext = outputType === "image/jpeg" ? ".jpg" : ".png";
          const name = file.name.replace(/\.[^.]+$/, ext);
          resolve(new File([blob], name, { type: outputType }));
        },
        outputType,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function processVideo(file: File): Promise<File> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:1px;height:1px";
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    container.appendChild(videoEl);
    document.body.appendChild(container);

    const cleanup = () => {
      try {
        document.body.removeChild(container);
      } catch {
        // noop
      }
      URL.revokeObjectURL(videoEl.src);
    };

    videoEl.onloadedmetadata = () => {
      const needsTrim = videoEl.duration > MAX_VIDEO_DURATION;
      const needsResize = videoEl.videoWidth > MAX_VIDEO_WIDTH;

      if (!needsTrim && !needsResize) {
        cleanup();
        resolve(file);
        return;
      }

      const targetDuration = Math.min(videoEl.duration, MAX_VIDEO_DURATION);
      const scale = needsResize ? MAX_VIDEO_WIDTH / videoEl.videoWidth : 1;
      const width = Math.round(videoEl.videoWidth * scale);
      const height = Math.round(videoEl.videoHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(file);
        return;
      }

      if (typeof canvas.captureStream !== "function") {
        cleanup();
        resolve(file);
        return;
      }

      const canvasStream = canvas.captureStream(30);

      try {
        const videoStream = (videoEl as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
        videoStream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      } catch {
        // noop
      }

      const mimeType =
        (["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] as const).find((candidate) =>
          MediaRecorder.isTypeSupported(candidate),
        ) ?? "video/webm";

      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webm"), { type: mimeType }));
      };

      recorder.start(200);
      videoEl.currentTime = 0;

      let frameHandle = 0;
      const drawLoop = () => {
        if (videoEl.currentTime >= targetDuration || videoEl.ended) {
          cancelAnimationFrame(frameHandle);
          recorder.stop();
          canvasStream.getTracks().forEach((track) => track.stop());
          return;
        }
        ctx.drawImage(videoEl, 0, 0, width, height);
        frameHandle = requestAnimationFrame(drawLoop);
      };

      const startPlayback = () => {
        videoEl
          .play()
          .then(() => {
            drawLoop();
          })
          .catch(() => {
            videoEl.muted = true;
            videoEl
              .play()
              .then(() => {
                drawLoop();
              })
              .catch(() => {
                cleanup();
                resolve(file);
              });
          });
      };

      startPlayback();
    };

    videoEl.onerror = () => {
      cleanup();
      resolve(file);
    };
    videoEl.src = URL.createObjectURL(file);
  });
}

export async function uploadMediaFiles<T extends { id?: number; url?: string } = { id?: number; url?: string }>(
  files: File[],
): Promise<T[]> {
  if (files.length === 0) {
    return [];
  }

  const session = getStoredSession();
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file, file.name);
  }

  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: {
      ...(session?.jwt ? { Authorization: `Bearer ${session.jwt}` } : {}),
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => ([]))) as
    | T[]
    | { error?: { message?: string }; message?: string };

  if (!response.ok || !Array.isArray(payload)) {
    const message = Array.isArray(payload)
      ? "Failed to upload media"
      : payload?.error?.message || payload?.message || "Failed to upload media";
    throw new Error(message);
  }

  return payload;
}
