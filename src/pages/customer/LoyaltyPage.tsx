import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox } from '../../components/shared/icons';

export default function LoyaltyPage({ go }: { go: (p: Page) => void }) {
  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge icon={IconBox}>Rewards Program</MonoBadge>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
                Loyalty & VIP Host Rewards
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1">Earn points on every booking and redeem free production upgrades.</p>
            </div>
            <button
              onClick={() => go('packages')}
              className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
            >
              Earn More Points
            </button>
          </div>

          <div className="bg-[#161823] text-white rounded-[2rem] p-6 md:p-8 mb-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">VIP Status Tier</div>
                <div className="text-2xl font-extrabold text-amber-300 mt-0.5">VIP Gold Host Member</div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Available Rewards Balance</div>
                <div className="text-3xl font-extrabold text-[#1090F8] mt-0.5">1,450 PTS</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/70 font-semibold">
                <span>Progress to Platinum Rank</span>
                <span>1,450 / 2,000 PTS (550 PTS remaining)</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#1090F8] to-amber-300 rounded-full w-[72%]" />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-[#24252c]/40 mb-4 ml-1">
            Redeemable Equipment Upgrades
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Free Low Fog Cloud Machine', pts: '300 PTS', desc: 'Complimentary bridal entrance cloud effect unit for your next wedding event.' },
              { title: '₱2,000 Off P3 LED Wall Upgrade', pts: '500 PTS', desc: 'Instant ₱2,000 discount voucher applied to any Package C setup.' },
              { title: 'Extra Dual Wireless Mics', pts: '200 PTS', desc: 'Additional dual UHF wireless host microphones with technicians.' },
              { title: 'Free Hazer Stage Atmosphere', pts: '400 PTS', desc: 'High-output stage haze machine for moving head light beams.' },
            ].map((r, i) => (
              <div key={i} className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.05] flex flex-col justify-between hover:border-[#1090F8]/30 transition-all">
                <div>
                  <span className="text-xs font-bold text-[#1090F8] bg-[#1090F8]/10 px-3 py-1 rounded-full">
                    {r.pts}
                  </span>
                  <h4 className="font-bold text-base text-[var(--ink)] mt-3">{r.title}</h4>
                  <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed">{r.desc}</p>
                </div>
                <button
                  onClick={() => alert(`Redeemed ${r.title}!`)}
                  className="mt-5 w-full bg-[var(--ink)] text-white text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm"
                >
                  Redeem Reward Voucher
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
