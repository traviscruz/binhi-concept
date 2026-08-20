import { useState } from 'react';

export function PhotoCarousel({ photos }: { photos: { url: string; label: string }[] }) {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  return (
    <div className="relative rounded-[2rem] overflow-hidden bg-[#12141d] aspect-[16/9] shadow-lg group">
      <div
        className="flex w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((p, i) => (
          <div key={i} className="w-full h-full shrink-0 relative">
            <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white border border-white/20 shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#1090F8]" />
                {p.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 z-10">
        <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-xs text-white/90">
          {index + 1} / {photos.length}
        </span>
      </div>

      <button
        onClick={prev}
        aria-label="Previous photo"
        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[var(--ink)] flex items-center justify-center shadow-md hover:bg-white transition-colors focus:outline-none opacity-0 group-hover:opacity-100 duration-300 z-20"
      >
        ←
      </button>
      <button
        onClick={next}
        aria-label="Next photo"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[var(--ink)] flex items-center justify-center shadow-md hover:bg-white transition-colors focus:outline-none opacity-0 group-hover:opacity-100 duration-300 z-20"
      >
        →
      </button>

      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-20">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'bg-white w-7' : 'bg-white/40 w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}