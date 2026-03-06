"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type CarouselImage = {
  id: number;
  url: string;
  alternativeText?: string | null;
};

export function PostCardCarousel({ images }: { images: CarouselImage[] }) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) return null;

  const img = images[idx]!;
  const src = img.url.startsWith("http") ? img.url : `${API_URL}${img.url}`;
  const single = images.length === 1;

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    setIdx((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    setIdx((i) => (i + 1) % images.length);
  };

  return (
    <div className="relative overflow-hidden rounded-lg bg-gray-100 select-none">
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={img.alternativeText ?? ""}
        className="w-full object-cover max-h-72"
        draggable={false}
      />

      {!single && (
        <>
          {/* Prev */}
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            aria-label="Ảnh trước"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* Next */}
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            aria-label="Ảnh tiếp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`}
                aria-label={`Ảnh ${i + 1}`}
              />
            ))}
          </div>

          {/* Counter */}
          <span className="absolute top-2 right-2 text-xs text-white bg-black/40 rounded-full px-2 py-0.5 leading-5">
            {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
