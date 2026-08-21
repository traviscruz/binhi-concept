import { useState } from 'react';
import { ImageWithSkeleton } from './ImageWithSkeleton';

export interface PhotoItem {
  url: string;
  label?: string;
}

export function PhotoCarousel({
  photos = [],
  mainImage,
}: {
  photos?: (PhotoItem | string)[];
  mainImage?: string;
}) {
  const [index, setIndex] = useState(0);

  // Normalize photos input into clean { url, label } list
  const list: { url: string; label: string }[] = [];

  if (Array.isArray(photos)) {
    photos.forEach((p, i) => {
      if (typeof p === 'string' && p.trim() && !p.includes('picsum.photos')) {
        list.push({ url: p.trim(), label: `Gallery Photo 0${i + 1}` });
      } else if (p && typeof p === 'object') {
        const itemUrl = (p as any).url || (p as any).src || (p as any).image_url || '';
        if (itemUrl && typeof itemUrl === 'string' && !itemUrl.includes('picsum.photos')) {
          list.push({
            url: itemUrl,
            label: (p as any).label || (p as any).title || `Gallery Photo 0${i + 1}`,
          });
        }
      }
    });
  }

  // Fall back to mainImage if gallery photos array is empty
  if (list.length === 0 && mainImage && mainImage.trim() && !mainImage.includes('picsum.photos')) {
    list.push({ url: mainImage.trim(), label: 'Primary Event Setup' });
  }

  const safeIndex = index >= list.length ? 0 : index;

  const prev = () => setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === list.length - 1 ? 0 : i + 1));

  // If no photos or images available, render single skeleton loader
  if (list.length === 0) {
    return (
      <div className="relative rounded-[2rem] overflow-hidden bg-[#12141d] aspect-[16/9] shadow-lg">
        <ImageWithSkeleton src="" alt="No Gallery Uploaded" className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="relative rounded-[2rem] overflow-hidden bg-[#12141d] aspect-[16/9] shadow-lg group">
      <div
        className="flex w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {list.map((p, i) => (
          <div key={i} className="w-full h-full shrink-0 relative">
            <ImageWithSkeleton src={p.url} alt={p.label} className="w-full h-full" />
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white border border-white/20 shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#1090F8]" />
                {p.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <>
          <div className="absolute top-4 right-4 z-10">
            <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-xs text-white/90">
              {safeIndex + 1} / {list.length}
            </span>
          </div>

          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[var(--ink)] flex items-center justify-center shadow-md hover:bg-white transition-colors focus:outline-none opacity-0 group-hover:opacity-100 duration-300 z-20 cursor-pointer"
          >
            ←
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[var(--ink)] flex items-center justify-center shadow-md hover:bg-white transition-colors focus:outline-none opacity-0 group-hover:opacity-100 duration-300 z-20 cursor-pointer"
          >
            →
          </button>

          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-20">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === safeIndex ? 'bg-white w-7' : 'bg-white/40 w-2'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}