import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconPlus, IconX, IconShield, IconSearch } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function InventoryAlertsPage({ go }: { go: (p: Page) => void }) {
  const [alerts, setAlerts] = useState([
    { id: 'alt-1', type: 'Maintenance Required', gear: 'P3 HD Indoor LED Wall Panel (LED-P3-001)', details: '100 operating hours reached. Optical tile recalibration & DMX test required.', severity: 'High', date: 'August 19, 2026' },
    { id: 'alt-2', type: 'Low Stock Warning', gear: 'UHF Wireless Microphones', details: 'Only 2 unassigned mic pairs remaining for the upcoming weekend of Sep 14.', severity: 'Medium', date: 'August 20, 2026' },
    { id: 'alt-3', type: 'Hardware Damage Log', gear: 'Moving Head Beam Fixture #08 (LGT-CHV-003)', details: 'Pan motor mechanism lagging slightly during fast strobe sequences. Gears need lubrication.', severity: 'High', date: 'August 18, 2026' },
  ]);

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [showAddAlertModal, setShowAddAlertModal] = useState(false);

  // Form State
  const [gearName, setGearName] = useState('Yamaha Active PA 12" Speaker (SPK-YAM-005)');
  const [alertType, setAlertType] = useState('Maintenance Required');
  const [severity, setSeverity] = useState('High');
  const [details, setDetails] = useState('');

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gearName.trim()) return;

    const newAlert = {
      id: `alt-${Date.now()}`,
      type: alertType,
      gear: gearName,
      details: details || 'Scheduled bench maintenance log.',
      severity,
      date: new Date().toISOString().split('T')[0],
    };

    setAlerts([newAlert, ...alerts]);
    setShowAddAlertModal(false);
    setGearName('');
    setDetails('');
  };

  const resolveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSev = severityFilter === 'All' || a.severity === severityFilter;
    const matchesSearch =
      a.gear.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      a.details.toLowerCase().includes(search.toLowerCase());
    return matchesSev && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Action Required ({alerts.length})</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Maintenance & Low Stock Alerts
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Log new equipment repair logs, monitor low stock thresholds, and mark maintenance as resolved.
          </p>
        </div>

        <button
          onClick={() => setShowAddAlertModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Log New Maintenance / Stock Alert
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-[#24252c]/50 font-semibold mr-1">Severity:</span>
          {['All', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                severityFilter === sev
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts or equipment..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Alerts Cards List */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <span className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">
            ✓
          </span>
          <h3 className="font-bold text-base text-[var(--ink)]">No Active Alerts</h3>
          <p className="text-xs text-[#24252c]/50 mt-1">All equipment units are fully operational and verified.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-500/40 transition-all"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      item.severity === 'High'
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : item.severity === 'Medium'
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : 'bg-[#1090F8]/10 text-[#1090F8] border border-[#1090F8]/20'
                    }`}
                  >
                    {item.severity} Priority
                  </span>
                  <span className="text-xs font-semibold text-[#1090F8]">{item.type}</span>
                  <span className="text-[11px] text-[#24252c]/40">• Logged {item.date}</span>
                </div>
                <h3 className="font-bold text-lg text-[var(--ink)] mt-2">{item.gear}</h3>
                <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed">{item.details}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => resolveAlert(item.id)}
                  className="bg-[#1090F8] text-white text-xs font-semibold px-4.5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
                >
                  Mark as Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddAlertModal && (
        <ModalOverlay onClose={() => setShowAddAlertModal(false)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setShowAddAlertModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
              <IconX className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Log Maintenance or Stock Alert</h3>
            <p className="text-xs text-[#24252c]/50 mb-4">Input equipment repair notes, low stock warnings, or calibration logs.</p>

            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Target Equipment Model / Serial ID</label>
                <select
                  value={gearName}
                  onChange={(e) => setGearName(e.target.value)}
                  className={inputClass + ' font-semibold'}
                >
                  <option value="Yamaha Active PA 12&quot; Speaker (SPK-YAM-005)">Yamaha Active PA 12&quot; Speaker (SPK-YAM-005)</option>
                  <option value="Yamaha Active PA 12&quot; Speaker (SPK-YAM-001)">Yamaha Active PA 12&quot; Speaker (SPK-YAM-001)</option>
                  <option value="P3 HD Indoor LED Wall Panel (LED-P3-001)">P3 HD Indoor LED Wall Panel (LED-P3-001)</option>
                  <option value="P3 HD Indoor LED Wall Panel (LED-P3-003)">P3 HD Indoor LED Wall Panel (LED-P3-003)</option>
                  <option value="Chauvet DJ Intimidator Spot 360 (LGT-[#1090F8]-001)">Chauvet DJ Intimidator Spot 360 (LGT-[#1090F8]-001)</option>
                  <option value="Chauvet DJ Intimidator Spot 360 (LGT-[#1090F8]-002)">Chauvet DJ Intimidator Spot 360 (LGT-[#1090F8]-002)</option>
                  <option value="Antari Z-1500 II Stage Fog Machine (HAZ-ANT-001)">Antari Z-1500 II Stage Fog Machine (HAZ-ANT-001)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Alert Category</label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value)}
                    className={inputClass + ' font-semibold'}
                  >
                    <option value="Maintenance Required">Maintenance Required</option>
                    <option value="Low Stock Warning">Low Stock Warning</option>
                    <option value="Hardware Damage Log">Hardware Damage Log</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Alert Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className={inputClass + ' font-semibold'}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Diagnostic Issue Description</label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe crackling audio, blown bulb, worn XLR jack, or missing spare parts..."
                  className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Log Maintenance Alert Record
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
