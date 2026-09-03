import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { logAuditEvent } from '../../utils/auditLogger';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors font-bold';

export default function AdminLoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [ptsPerPeso, setPtsPerPeso] = useState('100');
  const [silverThreshold, setSilverThreshold] = useState('500');
  const [goldThreshold, setGoldThreshold] = useState('1,500');
  const [platThreshold, setPlatThreshold] = useState('4,000');
  const [showSavedModal, setShowSavedModal] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await logAuditEvent({
      action: 'UPDATE_LOYALTY_SETTINGS',
      module: 'loyalty',
      targetId: 'loyalty-config',
      targetName: 'Binhi Loyalty Engine',
      details: `Saved loyalty configuration: ₱${ptsPerPeso}/pt. Tier Thresholds: Silver=${silverThreshold}pts, Gold=${goldThreshold}pts, VIP Platinum=${platThreshold}pts`,
      currentData: {
        points_per_peso: ptsPerPeso,
        silver_threshold: silverThreshold,
        gold_threshold: goldThreshold,
        platinum_threshold: platThreshold,
      },
    });
    setShowSavedModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Loyalty & Rewards Program</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Loyalty Engine Settings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure point conversion formulas, VIP host tier qualification rules, and reward vouchers.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
        >
          Save Loyalty Configuration
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 text-xs">
        <div className="bg-white rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">Points Earning Formula</h2>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Spent Amount Required per 1 Point (₱)</label>
            <input value={ptsPerPeso} onChange={(e) => setPtsPerPeso(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-[#24252c]/50 mt-1">Default: ₱100 spent = 1 Binhi Point</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">VIP Host Tier Requirements</h2>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Silver Host Minimum PTS</label>
            <input value={silverThreshold} onChange={(e) => setSilverThreshold(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Gold Host Minimum PTS</label>
            <input value={goldThreshold} onChange={(e) => setGoldThreshold(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">VIP Platinum Host Minimum PTS</label>
            <input value={platThreshold} onChange={(e) => setPlatThreshold(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <ModalOverlay isOpen={showSavedModal} onClose={() => setShowSavedModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button onClick={() => setShowSavedModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            ✓
          </div>
          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Loyalty Settings Saved</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Host point earning rules and VIP tier thresholds updated successfully across the platform.
          </p>
          <button
            onClick={() => setShowSavedModal(false)}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            Great, Got It
          </button>
        </div>
      </ModalOverlay>
    </div>
  );
}
