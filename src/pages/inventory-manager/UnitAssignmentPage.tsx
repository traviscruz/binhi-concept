import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconCalendar } from '../../components/shared/icons';

const inputClass =
  'rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function UnitAssignmentPage({ go }: { go: (p: Page) => void }) {
  const [selectedDate, setSelectedDate] = useState('2026-09-14');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [units, setUnits] = useState([
    { serial: 'LED-P3-001', name: 'P3 HD Indoor LED Wall Panel (Unit 1)', category: 'Video', booking: 'BNH-2026-889 (Grand Wedding)', date: '2026-09-14', venue: 'Shangri-La Fort BGC', status: 'Assigned' },
    { serial: 'LED-P3-002', name: 'P3 HD Indoor LED Wall Panel (Unit 2)', category: 'Video', booking: 'BNH-2026-889 (Grand Wedding)', date: '2026-09-14', venue: 'Shangri-La Fort BGC', status: 'Assigned' },
    { serial: 'SUB-D15-001', name: 'Dual 15-inch Active Subwoofer A', category: 'Audio', booking: 'BNH-2026-889 (Grand Wedding)', date: '2026-09-14', venue: 'Shangri-La Fort BGC', status: 'Assigned' },
    { serial: 'SUB-D15-002', name: 'Dual 15-inch Active Subwoofer B', category: 'Audio', booking: 'Unassigned (In Warehouse)', date: '2026-09-14', venue: 'Warehouse Unit A', status: 'Available' },
    { serial: 'MIC-UHF-001', name: 'UHF Wireless Host Mic Pair #1', category: 'Audio', booking: 'BNH-2026-502 (Tech Summit)', date: '2026-11-12', venue: 'Marriott Grand Ballroom', status: 'Assigned' },
    { serial: 'FOG-SMK-001', name: 'Low-Lying Fog Cloud Effect Generator', category: 'Effects', booking: 'Unassigned (In Warehouse)', date: '2026-09-14', venue: 'Warehouse Unit A', status: 'Available' },
  ]);

  const toggleAssignment = (serial: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.serial === serial) {
          const isAssigned = u.status === 'Assigned';
          return {
            ...u,
            status: isAssigned ? 'Available' : 'Assigned',
            booking: isAssigned ? 'Unassigned (In Warehouse)' : `BNH-2026-889 (Grand Wedding)`,
            date: selectedDate,
            venue: isAssigned ? 'Warehouse Unit A' : 'Shangri-La Fort BGC',
          };
        }
        return u;
      })
    );
  };

  const filteredUnits = units.filter((u) => {
    const matchesCat = categoryFilter === 'All' || u.category === categoryFilter;
    const matchesSearch =
      u.serial.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.booking.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Serial-Level Tracking</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Unit-Level Date Assignments
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Filter by event date and bind physical unit serial IDs to active customer bookings.
          </p>
        </div>

        <button
          onClick={() => go('inventory-items')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors self-start sm:self-auto"
        >
          View Equipment Catalog
        </button>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[var(--mist)] px-3.5 py-2 rounded-full border border-[#24252c]/10">
            <IconCalendar className="w-4 h-4 text-[#1090F8]" />
            <span className="text-xs font-semibold text-[#24252c]/60">Filter Event Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-[var(--ink)] focus:outline-none cursor-pointer"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            {['All', 'Audio', 'Video', 'Effects'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                  categoryFilter === cat
                    ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                    : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by serial ID or booking..."
          className={inputClass + ' w-full md:w-64'}
        />
      </div>

      {/* Serial Assignment Table */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Unit Serial ID</th>
                <th className="py-3 px-3 font-semibold">Physical Equipment Unit</th>
                <th className="py-3 px-3 font-semibold">Target Date</th>
                <th className="py-3 px-3 font-semibold">Event Booking & Venue</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {filteredUnits.map((unit) => (
                <tr key={unit.serial} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3.5 px-3 font-mono font-extrabold text-[#1090F8]">{unit.serial}</td>
                  <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{unit.name}</td>
                  <td className="py-3.5 px-3 font-medium text-[#24252c]/70">{unit.date}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-mono text-[var(--ink)] font-bold">{unit.booking}</div>
                    <div className="text-[10px] text-[#24252c]/50">{unit.venue}</div>
                  </td>
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
                      {unit.status === 'Assigned' ? 'Unbind Serial' : `Assign to ${selectedDate}`}
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
