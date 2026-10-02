import { useState, useEffect } from 'react';
import { ImageWithSkeleton } from './ImageWithSkeleton';
import { EquipmentCategoryPlaceholder } from './EquipmentCategoryPlaceholder';

export interface PhotoItem {
  url: string;
  label?: string;
}

export function PhotoCarousel({
  photos = [],
  mainImage,
  category,
  name,
}: {
  photos?: (PhotoItem | string)[] | string;
  mainImage?: string;
  category?: string;
  name?: string;
}) {
  const [index, setIndex] = useState(0);

  // Normalize images: 1st image is Cover Photo (mainImage), 2nd and next are Secondary Gallery Photos
  const list: { url: string; label: string }[] = [];
  const seenUrls = new Set<string>();

  // 1. First image: Cover Photo / Primary Event Setup (if valid)
  if (mainImage && typeof mainImage === 'string' && mainImage.trim() && !mainImage.includes('picsum.photos')) {
    const cleanMain = mainImage.trim();
    list.push({
      url: cleanMain,
      label: name ? `${name} (Cover Setup)` : 'Primary Event Setup',
    });
    seenUrls.add(cleanMain.toLowerCase());
  }

  // 2. Parse photos (could be array or JSON string from database)
  let rawPhotosList: any[] = [];
  if (Array.isArray(photos)) {
    rawPhotosList = photos;
  } else if (typeof photos === 'string') {
    try {
      const parsed = JSON.parse(photos);
      if (Array.isArray(parsed)) {
        rawPhotosList = parsed;
      } else if (typeof parsed === 'string' && parsed.trim()) {
        rawPhotosList = [parsed];
      }
    } catch {
      if (photos.trim() && !photos.startsWith('{') && !photos.startsWith('[')) {
        rawPhotosList = [photos.trim()];
      }
    }
  }

  // 3. Second and subsequent images: Secondary Gallery Photos
  rawPhotosList.forEach((p) => {
    if (typeof p === 'string' && p.trim() && !p.includes('picsum.photos')) {
      const cleanUrl = p.trim();
      if (!seenUrls.has(cleanUrl.toLowerCase())) {
        seenUrls.add(cleanUrl.toLowerCase());
        list.push({
          url: cleanUrl,
          label: `Gallery Photo 0${list.length + 1}`,
        });
      }
    } else if (p && typeof p === 'object') {
      const itemUrl = (p as any).url || (p as any).src || (p as any).image_url || '';
      if (itemUrl && typeof itemUrl === 'string' && !itemUrl.includes('picsum.photos')) {
        const cleanUrl = itemUrl.trim();
        if (!seenUrls.has(cleanUrl.toLowerCase())) {
          seenUrls.add(cleanUrl.toLowerCase());
          list.push({
            url: cleanUrl,
            label: (p as any).label || (p as any).title || `Gallery Photo 0${list.length + 1}`,
          });
        }
      }
    }
  });

  const safeIndex = index >= list.length ? 0 : index;

  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  };

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i === list.length - 1 ? 0 : i + 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (list.length <= 1) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [list.length]);

  // If no photos or images available, render EquipmentCategoryPlaceholder with category icon
  if (list.length === 0) {
    return (
      <div className="relative rounded-[2rem] overflow-hidden bg-[#12141d] aspect-[16/9] shadow-lg">
        <EquipmentCategoryPlaceholder category={category} name={name} size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Showcase Frame */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#12141d] aspect-[16/9] shadow-xl group select-none">
        <div
          className="flex w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {list.map((p, i) => (
            <div key={i} className="w-full h-full shrink-0 relative">
              <ImageWithSkeleton src={p.url} alt={p.label} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white border border-white/20 shadow-md">
                  <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[#1090F8]' : 'bg-emerald-400'}`} />
                  {p.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {list.length > 1 && (
          <>
            {/* Slide Position Counter */}
            <div className="absolute top-4 right-4 z-10">
              <span className="rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-white/90 border border-white/10 shadow-sm font-mono">
                {safeIndex + 1} / {list.length}
              </span>
            </div>

            {/* Left Arrow Button */}
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-[var(--ink)] flex items-center justify-center shadow-xl border border-black/10 transition-all focus:outline-none opacity-0 group-hover:opacity-100 duration-200 z-20 cursor-pointer hover:scale-105 active:scale-95"
            >
              ←
            </button>

            {/* Right Arrow Button */}
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-[var(--ink)] flex items-center justify-center shadow-xl border border-black/10 transition-all focus:outline-none opacity-0 group-hover:opacity-100 duration-200 z-20 cursor-pointer hover:scale-105 active:scale-95"
            >
              →
            </button>

            {/* Indicator Dots */}
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-20">
              {list.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer shadow-sm ${
                    i === safeIndex ? 'bg-white w-7' : 'bg-white/40 hover:bg-white/70 w-2'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Optional Thumbnail Strip for Multi-Photo Packages */}
      {list.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1 px-1">
          {list.map((photo, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setIndex(idx)}
                className={`relative w-20 sm:w-24 aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-[#1090F8] ring-2 ring-[#1090F8]/30 scale-105 shadow-md'
                    : 'border-[#24252c]/15 opacity-60 hover:opacity-100 hover:border-[#1090F8]/50'
                }`}
              >
                <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 text-[8px] font-bold px-1.5 py-0.2 rounded bg-black/70 text-white backdrop-blur-xs">
                  {idx === 0 ? 'Cover' : `0${idx + 1}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}