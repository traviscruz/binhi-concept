import type { Page } from '../../types';
import { MonoBadge, MonoBadgeDark } from '../../components/shared/Badges';
import { IconArrow, IconBox } from '../../components/shared/icons';

export default function AboutPage({ go }: { go: (p: Page) => void }) {
  const steps = [
    { num: '01', title: 'Browse Real Packages & Inventory', desc: 'No more "inbox us for price". See instant equipment specs, real photo galleries, and clear pricing.' },
    { num: '02', title: 'Customize Your Setup & Date', desc: 'Add LED walls, extra mics, or stage hazers. Lock in your exact date with real-time crew availability.' },
    { num: '03', title: 'Upload Deposit Slip', desc: 'Secure your booking with a 50% reservation fee via GCash or Bank Transfer. Get instant confirmation.' },
    { num: '04', title: 'We Rig, Operate & Breakdown', desc: 'Our technical crew arrives 2 hours early, pre-checks audio & lights, and manages soundcheck flawlessly.' },
  ];

  return (
    <section className="pt-40 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <MonoBadge icon={IconBox}>How BINHI Works</MonoBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Boutique Event Production,
            <br />
            Built for Modern Hosts.
          </h1>
          <p className="text-[#24252c]/60 mt-4 text-base max-w-xl mx-auto leading-relaxed">
            We removed the friction from booking sound, stage lighting, and video walls in the Philippines.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {steps.map((s, i) => (
            <div key={i} className="p-6 rounded-[2rem] bg-[var(--mist)] border border-[#24252c]/[0.05] flex flex-col justify-between">
              <div>
                <span className="text-2xl font-extrabold text-[#1090F8] mono">{s.num}</span>
                <h3 className="font-bold text-lg text-[var(--ink)] mt-3 leading-snug">{s.title}</h3>
                <p className="text-xs text-[#24252c]/60 mt-2 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#161823] text-white rounded-[2.5rem] p-8 md:p-12 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <MonoBadgeDark>Quality Guarantee</MonoBadgeDark>
            <h2 className="text-3xl font-extrabold tracking-tight mt-4">Zero feedback. Zero delayed setups.</h2>
            <p className="text-white/60 mt-3 text-sm leading-relaxed">
              Every speaker cabinet, moving head fixture, and LED tile is bench-tested at our warehouse 24 hours before your event. Operated exclusively by certified sound engineers and DMX lighting technicians.
            </p>
            <button
              onClick={() => go('packages')}
              className="mt-8 bg-white text-[var(--ink)] text-sm font-semibold px-8 py-3.5 rounded-full inline-flex items-center gap-2 hover:bg-white/90 transition-colors"
            >
              Explore our packages <IconArrow className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}