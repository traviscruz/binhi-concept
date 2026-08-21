import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCheck, IconBox, IconCalendar, IconPin, IconX, IconShield } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';

export interface SetupStage {
  id: string;
  stepNum: number;
  title: string;
  desc: string;
  completed: boolean;
  completedAt?: string;
}

export default function CrewSetupTeardownPage({ go }: { go: (p: Page) => void }) {
  const [stages, setStages] = useState<SetupStage[]>([
    {
      id: 'st-1',
      stepNum: 1,
      title: 'Warehouse Packing & Dispatch',
      desc: 'Verify all physical units against packing checklist, load rigging truck, and dispatch from warehouse.',
      completed: true,
      completedAt: '07:30 AM',
    },
    {
      id: 'st-2',
      stepNum: 2,
      title: 'On-Site Stage Rigging & Cable Run',
      desc: 'Unload gear at venue, position speaker stands, mount LED panels to truss, and lay XLR multi-snake cable runs.',
      completed: true,
      completedAt: '09:45 AM',
    },
    {
      id: 'st-3',
      stepNum: 3,
      title: 'Sound & LED Display Calibration Test',
      desc: 'Perform pink noise speaker tuning, test wireless mics, calibrate LED video wall brightness, and test low-fog hazer.',
      completed: false,
    },
    {
      id: 'st-4',
      stepNum: 4,
      title: 'Live Event Production Support',
      desc: 'Standby on-site for live sound mixing, stage light cues, and technical troubleshooting throughout the event duration.',
      completed: false,
    },
    {
      id: 'st-5',
      stepNum: 5,
      title: 'Teardown, Inventory Audit & Return',
      desc: 'Dismantle stage equipment, pack back into flight cases, audit serial IDs, and return to warehouse shelf storage.',
      completed: false,
    },
  ]);

  const [confirmCompleteModal, setConfirmCompleteModal] = useState(false);

  const toggleStage = (id: string) => {
    setStages((prev) =>
      prev.map((st) => {
        if (st.id === id) {
          const nextState = !st.completed;
          return {
            ...st,
            completed: nextState,
            completedAt: nextState ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          };
        }
        return st;
      })
    );
  };

  const completedCount = stages.filter((st) => st.completed).length;
  const progressPct = Math.round((completedCount / stages.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <button onClick={() => go('crew-assigned-bookings')} className="text-xs text-[#1090F8] font-bold hover:underline mb-1 inline-block">
            ← Back to Assigned Bookings
          </button>
          <MonoBadge icon={IconCheck}>Workflow Stage Tracker</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Setup & Teardown Completion Toggle
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Toggle real-time stage completion milestones for event <strong className="text-[var(--ink)] font-mono">BNH-2026-889</strong>.
          </p>
        </div>

        <button
          onClick={() => setConfirmCompleteModal(true)}
          className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          Mark All Stages Complete
        </button>
      </div>

      {/* Progress Status Banner */}
      <div className="bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider opacity-80">Current Event Milestone</div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
            {progressPct === 100 ? 'Event Teardown Complete' : `Stage ${completedCount + 1} of ${stages.length} In Progress`}
          </div>
          <div className="text-xs opacity-90 mt-1">
            {completedCount} of {stages.length} workflow steps verified by Lead Tech Marco Valenzuela
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center shrink-0">
          <div className="text-2xl font-black">{progressPct}%</div>
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Overall Progress</div>
        </div>
      </div>

      {/* Interactive Setup Stages List */}
      <div className="space-y-4">
        {stages.map((st) => (
          <div
            key={st.id}
            className={`p-5 rounded-2xl border transition-all ${
              st.completed
                ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                : 'bg-white border-[#24252c]/[0.08] shadow-sm hover:border-[#1090F8]/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                    st.completed ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10'
                  }`}
                >
                  0{st.stepNum}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink)]">
                      Step {st.stepNum}
                    </span>
                    <h3 className="font-extrabold text-base text-[var(--ink)]">{st.title}</h3>
                    {st.completedAt && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Logged at {st.completedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#24252c]/65 mt-1 leading-relaxed">{st.desc}</p>
                </div>
              </div>

              <button
                onClick={() => toggleStage(st.id)}
                className={`w-full sm:w-auto text-xs font-extrabold px-5 py-2.5 rounded-full border transition-all shrink-0 ${
                  st.completed
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                    : 'bg-white text-[var(--ink)] border-[#24252c]/15 hover:border-[#1090F8] hover:text-[#1090F8]'
                }`}
              >
                {st.completed ? 'Completed' : 'Mark Stage Done'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <ModalOverlay isOpen={confirmCompleteModal} onClose={() => setConfirmCompleteModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button onClick={() => setConfirmCompleteModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            <IconCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Mark Event Complete?</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            This will mark all 5 setup & teardown stages as complete and update inventory status back to warehouse storage.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setConfirmCompleteModal(false)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setStages((prev) => prev.map((s) => ({ ...s, completed: true })));
                setConfirmCompleteModal(false);
              }}
              className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-full hover:bg-emerald-700 transition-colors shadow-md cursor-pointer"
            >
              Yes, Complete Event
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
