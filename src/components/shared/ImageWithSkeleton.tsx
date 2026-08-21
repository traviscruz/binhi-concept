import { useState } from 'react';

export function ImageWithSkeleton({
  src,
  alt = 'Media',
  className = '',
  aspectRatio = '',
}: {
  src?: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Check if image link is valid (not empty or mock placeholder URL)
  const isValidSrc = Boolean(
    src &&
      typeof src === 'string' &&
      src.trim().length > 0 &&
      !src.includes('picsum.photos') &&
      !src.includes('placeholder.com') &&
      !src.includes('via.placeholder')
  );

  return (
    <div className={`relative overflow-hidden bg-[#161822] ${aspectRatio} ${className}`}>
      {/* Loading Skeleton Pulse Shimmer */}
      {(!loaded || !isValidSrc || error) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-r from-[#181a26] via-[#222536] to-[#181a26] animate-pulse p-4">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center mb-2 shadow-inner">
            <svg
              className="w-5 h-5 text-white/40 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40 font-semibold">
            {isValidSrc && !error ? 'Loading Media...' : 'No Media Uploaded'}
          </span>
        </div>
      )}

      {/* Real Image */}
      {isValidSrc && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-all duration-500 ${
            loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        />
      )}
    </div>
  );
}
