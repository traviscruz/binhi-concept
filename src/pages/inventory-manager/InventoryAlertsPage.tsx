import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconX, IconShield, IconSearch, IconPlus } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface InventoryAlertItem {
  id: string;
  type: string; // 'Maintenance Required', 'Hardware Damage Log'
  gear: string;
  details: string;
  severity: 'High' | 'Medium' | 'Low';
  date: string;
  modelId?: string;
  serialId?: string;
  isCustomAlert?: boolean;
}

export default function InventoryAlertsPage({ go: _go }: { go: (p: Page) => void }) {
  const [alerts, setAlerts] = useState<InventoryAlertItem[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [showAddAlertModal, setShowAddAlertModal] = useState(false);

  // Form State
  const [selectedTarget, setSelectedTarget] = useState('');
  const [alertType, setAlertType] = useState('Maintenance Required');
  const [severity, setSeverity] = useState<'High' | 'Medium' | 'Low'>('High');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================================
  // SUPABASE READ (FETCH MODELS, UNITS & MAINTENANCE ALERTS)
  // =========================================================================
  const fetchAlertsAndInventory = async () => {
    setLoading(true);
    try {
      // 1. Fetch equipment models & physical units
      const { data: modelsData, error: modelsError } = await supabase
        .from('equipment_models')
        .select('*, units:physical_units(*)')
        .order('created_at', { ascending: false });

      if (modelsError) throw modelsError;

      // 2. Fetch active custom maintenance alerts
      const { data: customAlertsData, error: alertsError } = await supabase
        .from('inventory_alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.warn('Custom alerts table fetch note:', alertsError);
      }

      setEquipmentModels(modelsData || []);

      const derivedAlerts: InventoryAlertItem[] = [];

      if (modelsData && modelsData.length > 0) {
        modelsData.forEach((m: any) => {
          const units = m.units || [];

          // Maintenance & Hardware Damage Alerts for physical units
          units.forEach((u: any) => {
            if (
              u.condition === 'In Repair' ||
              u.condition === 'Needs Inspection' ||
              u.condition === 'Minor Wear' ||
              u.status === 'Maintenance / Repair' ||
              u.status === 'Decommissioned / Inactive'
            ) {
              const isHigh = u.condition === 'In Repair' || u.status === 'Decommissioned / Inactive';
              derivedAlerts.push({
                id: `unit-${u.serial_id}`,
                type: u.condition === 'In Repair' ? 'Hardware Damage Log' : 'Maintenance Required',
                gear: `${m.name} (${u.serial_id})`,
                details: u.notes || `Unit condition is currently flagged as ${u.condition} (${u.status}).`,
                severity: isHigh ? 'High' : 'Medium',
                date: u.last_maintenance || new Date().toISOString().split('T')[0],
                modelId: m.model_id,
                serialId: u.serial_id,
              });
            }
          });
        });
      }

      // Add custom logged alerts from database (excluding stock warnings)
      if (customAlertsData && customAlertsData.length > 0) {
        customAlertsData.forEach((ca: any) => {
          if (ca.alert_type !== 'Low Stock Warning') {
            derivedAlerts.push({
              id: ca.id,
              type: ca.alert_type,
              gear: ca.gear_name,
              details: ca.details,
              severity: ca.severity as any,
              date: ca.created_at ? ca.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              modelId: ca.model_id,
              serialId: ca.serial_id,
              isCustomAlert: true,
            });
          }
        });
      }

      setAlerts(derivedAlerts);
    } catch (err) {
      console.warn('Supabase alerts fetch note:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndInventory();
  }, []);

  // Helper: Log Action to Audit Logs
  const logAuditToSupabase = async (action: string, targetId: string, details: string) => {
    try {
      await supabase.from('audit_logs').insert({
        action,
        module: 'inventory',
        target_id: targetId,
        details,
        user_role: 'inventory_manager',
      });
    } catch (err) {
      console.warn('Audit log insert note:', err);
    }
  };

  // =========================================================================
  // SUPABASE CREATE MAINTENANCE ALERT
  // =========================================================================
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;

    setIsSubmitting(true);
    const gearDisplayName = selectedTarget || (equipmentModels[0]?.name ? `${equipmentModels[0].name}` : 'General Equipment');

    try {
      // 1. Insert into inventory_alerts table
      const { error: alertInsertError } = await supabase.from('inventory_alerts').insert({
        alert_type: alertType,
        severity: severity,
        gear_name: gearDisplayName,
        details: details.trim(),
        status: 'active',
      });

      if (alertInsertError) {
        console.warn('Supabase DB Insert Alert Note:', alertInsertError);
      }

      // 2. If target is a physical unit serial tag, update unit condition in physical_units table
      if (selectedTarget.includes('(') && selectedTarget.includes(')')) {
        const serialTagMatch = selectedTarget.match(/\(([^)]+)\)/);
        const serialTag = serialTagMatch ? serialTagMatch[1] : null;

        if (serialTag) {
          const newCondition = alertType === 'Hardware Damage Log' ? 'In Repair' : 'Needs Inspection';
          await supabase
            .from('physical_units')
            .update({
              condition: newCondition,
              notes: details.trim(),
              last_maintenance: new Date().toISOString().split('T')[0],
            })
            .eq('serial_id', serialTag);
        }
      }

      await logAuditToSupabase(
        'CREATE_MAINTENANCE_ALERT',
        gearDisplayName,
        `Logged ${severity} priority maintenance alert: ${alertType} (${details.trim()})`
      );

      // Re-fetch database alerts
      await fetchAlertsAndInventory();

      setShowAddAlertModal(false);
      setDetails('');
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.warn('Create alert error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // SUPABASE UPDATE / RESOLVE ALERT
  // =========================================================================
  const resolveAlert = async (item: InventoryAlertItem) => {
    try {
      // 1. If it's a physical serial unit alert, reset unit condition to Operational (Good)
      if (item.serialId) {
        await supabase
          .from('physical_units')
          .update({
            condition: 'Operational (Good)',
            status: 'Available in Warehouse',
            last_maintenance: new Date().toISOString().split('T')[0],
            notes: null,
          })
          .eq('serial_id', item.serialId);
      }

      // 2. If it's a custom alert in inventory_alerts table, update status to resolved
      if (item.isCustomAlert) {
        await supabase
          .from('inventory_alerts')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }

      await logAuditToSupabase(
        'RESOLVE_MAINTENANCE_ALERT',
        item.serialId || item.modelId || item.id,
        `Marked maintenance alert for ${item.gear} as resolved.`
      );

      setAlerts((prev) => prev.filter((a) => a.id !== item.id));
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.warn('Resolve alert error:', err);
      setAlerts((prev) => prev.filter((a) => a.id !== item.id));
      window.dispatchEvent(new Event('inventory-updated'));
    }
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Maintenance Logs ({alerts.length})</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Maintenance & Repair Alerts
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Real-time equipment repair logs, bench maintenance inspections, and hardware damage reports.
          </p>
        </div>

        <button
          onClick={() => setShowAddAlertModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md self-start sm:self-auto flex items-center gap-2 cursor-pointer"
        >
          <IconPlus className="w-4 h-4" /> Log Maintenance Alert
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
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
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
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-xs text-[#24252c]/50 border border-[#24252c]/[0.08]">
          Fetching maintenance alerts from database...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm p-8 text-center">
          <EmptyState
            icon={IconShield}
            title="No Active Maintenance Alerts"
            description="All registered equipment models and physical serial units are operational and in good condition."
          />
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
                  onClick={() => resolveAlert(item)}
                  className="bg-[#1090F8] text-white text-xs font-semibold px-4.5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer"
                >
                  Mark as Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log New Alert Modal */}
      <ModalOverlay isOpen={showAddAlertModal} onClose={() => setShowAddAlertModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowAddAlertModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">
            Log Maintenance Alert
          </h3>
          <p className="text-xs text-[#24252c]/50 mb-4">
            Input equipment repair notes, damage reports, or bench inspection logs.
          </p>

          <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Target Equipment Model / Serial Unit
              </label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className={inputClass + ' font-semibold py-3'}
              >
                <option value="">Select Equipment Target...</option>
                {equipmentModels.map((m) => (
                  <optgroup key={m.model_id} label={`${m.brand} ${m.name} (${m.model_id})`}>
                    <option value={`${m.name} (${m.model_id})`}>
                      Master Model: {m.brand} {m.name}
                    </option>
                    {(m.units || []).map((u: any) => (
                      <option key={u.serial_id} value={`${m.name} (${u.serial_id})`}>
                        Serial Unit: {u.serial_id} — {u.condition}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Alert Category
                </label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className={inputClass + ' font-semibold py-3'}
                >
                  <option value="Maintenance Required">Maintenance Required</option>
                  <option value="Hardware Damage Log">Hardware Damage Log</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Alert Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className={inputClass + ' font-semibold py-3'}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Diagnostic Issue Description
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe crackling audio, blown bulb, worn XLR jack, or hardware damage..."
                className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Alert...' : 'Log Maintenance Alert Record'}
            </button>
          </form>
        </div>
      </ModalOverlay>
    </div>
  );
}
