import { useState } from 'react';

import { TESTIMONIALS_DATA } from '../../data/testimonials';
import { MonoBadgeDark } from './Badges';

export function TestimonialsSection() {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i === 0 ? TESTIMONIALS_DATA.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === TESTIMONIALS_DATA.length - 1 ? 0 : i + 1));

  const t = TESTIMONIALS_DATA[index];

  return (
    <div className="w-full bg-[#12141d] text-white py-24 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-[#1090F8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <MonoBadgeDark>TESTIMONIALS</MonoBadgeDark>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4 text-white">
          What our clients say
        </h2>
      </div>

      <div className="max-w-2xl mx-auto mt-10 bg-white text-[var(--ink)] rounded-2xl md:rounded-3xl p-8 md:p-12 shadow-2xl relative border border-white/20 z-10">
        <div className="flex items-center gap-1 mb-6">
          {Array.from({ length: t.stars }).map((_, i) => (
            <span key={i} className="text-amber-400 text-lg">★</span>
          ))}
        </div>

        <blockquote className="text-lg md:text-xl font-medium tracking-tight text-[#24252c]/90 leading-relaxed min-h-[5.5rem]">
          "{t.quote}"
        </blockquote>

        <div className="h-px bg-gradient-to-r from-transparent via-[#24252c]/10 to-transparent my-8" />

        <div className="flex flex-col items-end text-right">
          <span className="font-handwriting text-3xl md:text-4xl text-[var(--ink)] font-bold tracking-wide">
            {t.author}
          </span>
          <span className="text-xs font-semibold text-[#24252c]/50 mt-1 uppercase tracking-wider">
            {t.role} · {t.event}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex items-center justify-between mt-8 relative z-10">
        <button
          onClick={prev}
          aria-label="Previous testimonial"
          className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors focus:outline-none"
        >
          ←
        </button>

        <div className="flex items-center gap-2">
          {TESTIMONIALS_DATA.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === index ? 'bg-[#1090F8] w-6' : 'bg-white/20 w-2.5'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Next testimonial"
          className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors focus:outline-none"
        >
          →
        </button>
      </div>
    </div>
  );
}