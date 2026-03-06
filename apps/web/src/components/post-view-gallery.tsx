"use client";

import { useState } from "react";
import { StrapiImage } from "@/lib/strapi";
import { Lightbox } from "./lightbox";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

function resolveUrl(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export function PostViewGallery({ images }: { images: StrapiImage[] }) {
  const [idx, setIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const lightboxImages = images.map((img) => ({
    src: resolveUrl(img.url),
    alt: img.alternativeText ?? "",
  }));

  const current = lightboxImages[idx]!;
  const single = images.length === 1;

  return (
    <>
      <div className="rounded-xl overflow-hidden bg-gray-900 select-none">
        {/* Main media */}
        <div className="relative">
          {images[idx]?.mime?.startsWith("video/") ? (
            <video
              src={current.src}
              className="w-full max-h-[520px] object-contain bg-gray-900"
              controls
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={current.alt}
              className="w-full max-h-[520px] object-contain bg-gray-900 cursor-zoom-in"
              onClick={() => setLightboxIdx(idx)}
              draggable={false}
            />
          )}

          {!single && (
            <>
              {/* Prev */}
              <button
                onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="Ảnh trước"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {/* Next */}
              <button
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label="Ảnh tiếp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {/* Counter */}
              <span className="absolute top-3 right-3 text-xs text-white bg-black/50 rounded-full px-2.5 py-0.5 leading-5">
                {idx + 1}/{images.length}
              </span>
            </>
          )}

          {/* Expand icon (images only) */}
          {!images[idx]?.mime?.startsWith("video/") && (
            <button
              onClick={() => setLightboxIdx(idx)}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Phóng to"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Thumbnail strip */}
        {!single && (
          <div className="flex gap-1.5 p-2 bg-gray-800 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIdx(i)}
                className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                  i === idx
                    ? "border-white opacity-100"
                    : "border-transparent opacity-50 hover:opacity-75"
                }`}
              >
                {img.mime?.startsWith("video/") ? (
                  <video src={resolveUrl(img.url)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveUrl(img.url)} alt="" className="w-full h-full object-cover" draggable={false} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </>
  );
}
