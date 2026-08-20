import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield } from '../../components/shared/icons';

export default function UnitAssignmentPage({ go }: { go: (p: Page) => void }) {
  const [units, setUnits] = useState([
    { serial: 'LED-P3-001', name: 'P3 HD Indoor LED Wall Panel (Unit 1)', category: 'Video', booking: 'BNH-2026-889 (Grand Wedding)', status: 'Assigned' },
    { serial: 'LED-P3-002', name: 'P3 HD Indoor LED Wall Panel (Unit 2)', category: 'Video', booking: 'BNH-2026-889 (Grand Wedding)', status: 'Assigned' },
    { serial: 'SUB-D15-001', name: 'Dual 15-inch Active Subwoofer A', category: 'Audio', booking: 'BNH-2026-889 (Grand Wedding)', status: 'Assigned' },
    { serial: 'SUB-D15-002', name: 'Dual 15-inch Active Subwoofer B', category: 'Audio', booking: 'Unassigned (In Warehouse)', status: 'Available' },
    { serial: 'MIC-UHF-001', name: 'UHF Wireless Host Mic Pair #1', category: 'Audio', booking: 'BNH-2026-502 (Tech Summit)', status: 'Assigned' },
    { serial: 'FOG-SMK-001', name: 'Low-Lying Fog Cloud Effect Generator', category: 'Effects', booking: 'Unassigned (In Warehouse)', status: 'Available' },
  ]);

  const toggleAssignment = (serial: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.serial === serial) {
          const isAssigned = u.status === 'Assigned';
          return {
            ...u,
            status: isAssigned ? 'Available' : 'Assigned',
            booking: isAssigned ? 'Unassigned (In Warehouse)' : 'BNH-2026-889 (Grand Wedding)',
          };
        }
        return u;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Serial-Level Tracking</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Unit-Level Booking Assignments
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Bind specific physical unit serial numbers to active customer event bookings.</p>
        </div>

        <button
          onClick={() => go('inventory-items')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors"
        >
          View Equipment Catalog
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Unit Serial Tag</th>
                <th className="py-3 px-3 font-semibold">Physical Equipment Unit</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Assigned Event Booking</th>
                <th className="py-3 px-3 font-semibold">Unit Status</th>
                <th className="py-3 px-3 font-semibold text-right">Toggle Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {units.map((unit) => (
                <tr key={unit.serial} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3.5 px-3 font-mono font-extrabold text-[#1090F8]">{unit.serial}</td>
                  <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{unit.name}</td>
                  <td className="py-3.5 px-3 text-[#24252c]/60">{unit.category}</td>
                  <td className="py-3.5 px-3 font-mono text-[#24252c]/80">{unit.booking}</td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        unit.status === 'Assigned'
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}
                    >
                      {unit.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => toggleAssignment(unit.serial)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                        unit.status === 'Assigned'
                          ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                          : 'bg-[#1090F8]/10 border-[#1090F8]/30 text-[#1090F8] hover:bg-[#1090F8] hover:text-white'
                      }`}
                    >
                      {unit.status === 'Assigned' ? 'Unbind Unit' : 'Assign to Event'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
