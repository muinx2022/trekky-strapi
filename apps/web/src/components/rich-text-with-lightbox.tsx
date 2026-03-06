"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbox, type LightboxImage } from "./lightbox";

type LightboxState = { images: LightboxImage[]; index: number } | null;

type Props = {
  html: string;
  className?: string;
};

export function RichTextWithLightbox({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  useEffect(() => {
    if (!ref.current) return;

    const imgs = Array.from(ref.current.querySelectorAll("img")) as HTMLImageElement[];
    if (imgs.length === 0) return;

    const lightboxImages = imgs.map((img) => ({ src: img.src, alt: img.alt || undefined }));
    const cleanup: Array<() => void> = [];

    imgs.forEach((img, i) => {
      img.style.cursor = "zoom-in";
      const handler = () => setLightbox({ images: lightboxImages, index: i });
      img.addEventListener("click", handler);
      cleanup.push(() => img.removeEventListener("click", handler));
    });

    return () => cleanup.forEach((fn) => fn());
  }, [html]);

  return (
    <>
      <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : null))}
        />
      )}
    </>
  );
}
