import { StrapiImage } from "@/lib/strapi";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

function resolveUrl(url: string) {
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

function GalleryMedia({ img, className = "" }: { img: StrapiImage; className?: string }) {
  if (img.mime?.startsWith("video/")) {
    return (
      <video
        src={resolveUrl(img.url)}
        className={`w-full h-full object-cover ${className}`}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveUrl(img.url)}
      alt={img.alternativeText ?? ""}
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
    />
  );
}

export function PostGallery({ images }: { images: StrapiImage[] }) {
  if (!images || images.length === 0) return null;

  const count = images.length;

  if (count === 1) {
    return (
      <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
        <GalleryMedia img={images[0]} className="aspect-video object-cover" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {images.map((img) => (
          <div key={img.id} className="aspect-square overflow-hidden">
            <GalleryMedia img={img} />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800" style={{ height: "200px" }}>
        <div className="col-span-2 overflow-hidden">
          <GalleryMedia img={images[0]} />
        </div>
        <div className="flex flex-col gap-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <GalleryMedia img={images[1]} />
          </div>
          <div className="flex-1 overflow-hidden">
            <GalleryMedia img={images[2]} />
          </div>
        </div>
      </div>
    );
  }

  // 4+ images: 2×2 grid, +N overlay on 4th cell
  const display = images.slice(0, 4);
  const overflow = count - 4;

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
      {display.map((img, idx) => (
        <div key={img.id} className="relative aspect-square overflow-hidden">
          <GalleryMedia img={img} />
          {idx === 3 && overflow > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-2xl font-bold">
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
