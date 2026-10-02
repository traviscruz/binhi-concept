import { useState, useEffect, useRef } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconX, IconShield, IconSearch, IconPlus, IconCheck, IconChevronDown } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

function SearchableEquipmentSelect({
  equipmentModels,
  value,
  onChange,
  placeholder = 'Select equipment or serial unit...',
  className = '',
}: {
  equipmentModels: any[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter models and physical units
  const query = search.trim().toLowerCase();

  const filteredGroups = equipmentModels
    .map((m) => {
      const modelMatch =
        (m.name || '').toLowerCase().includes(query) ||
        (m.brand || '').toLowerCase().includes(query) ||
        (m.category || '').toLowerCase().includes(query) ||
        (m.model_id || '').toLowerCase().includes(query);

      const matchingUnits = (m.units || []).filter((u: any) => {
        if (!query) return true;
        if (modelMatch) return true;
        return (
          (u.serial_id || '').toLowerCase().includes(query) ||
          (u.condition || '').toLowerCase().includes(query) ||
          (u.status || '').toLowerCase().includes(query)
        );
      });

      const includeModel = modelMatch || matchingUnits.length > 0;
      return includeModel
        ? {
            model: m,
            modelMatch,
            units: matchingUnits,
          }
        : null;
    })
    .filter(Boolean) as Array<{
    model: any;
    modelMatch: boolean;
    units: any[];
  }>;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full rounded-2xl border px-4 py-2.5 text-xs bg-[#EEEEEE] hover:bg-[#E5E5E5] text-left flex items-center justify-between transition-all border-transparent focus:outline-none focus:border-[#1090F8] cursor-pointer group"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <IconSearch className="w-3.5 h-3.5 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
          {value ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-[var(--ink)] truncate">{value}</span>
            </div>
          ) : (
            <span className="text-[#24252c]/50 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              title="Clear selection"
            >
              <IconX className="w-3.5 h-3.5" />
            </span>
          )}
          <IconChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-[#24252c]/10 overflow-hidden">
          {/* Search Header */}
          <div className="p-2.5 bg-gray-50/90 border-b border-gray-100 flex items-center gap-2">
            <IconSearch className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, brand, serial ID (e.g. MIC-001)..."
              className="w-full text-xs bg-transparent border-none outline-none text-[var(--ink)] placeholder:text-gray-400 font-medium"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <IconX className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick status banner */}
          <div className="px-3 py-1.5 bg-gray-50/40 text-[10px] font-semibold uppercase tracking-wider text-[#24252c]/40 flex items-center justify-between border-b border-gray-100">
            <span>
              {filteredGroups.length} {filteredGroups.length === 1 ? 'Model' : 'Models'} Available
            </span>
            <span>Select master model or unit</span>
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100/70 p-1.5">
            {filteredGroups.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-xs font-semibold text-gray-700">No equipment matching "{search}"</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Try searching with a serial ID (e.g. SPK-001) or model name.
                </p>
              </div>
            ) : (
              filteredGroups.map(({ model: m, units }) => {
                const masterModelVal = `${m.name} (${m.model_id})`;
                const isMasterSelected = value === masterModelVal;

                return (
                  <div key={m.model_id} className="py-2 first:pt-1 last:pb-1">
                    {/* Model Header */}
                    <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-gray-700">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">
                          {m.brand} {m.name}
                        </span>
                        <span className="text-[10px] font-mono font-normal text-gray-400">({m.model_id})</span>
                      </div>
                      {m.category && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                          {m.category}
                        </span>
                      )}
                    </div>

                    {/* Master Model Option */}
                    <button
                      type="button"
                      onClick={() => handleSelect(masterModelVal)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer group mt-0.5 ${
                        isMasterSelected ? 'bg-sky-50 text-sky-700 font-bold' : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-100/70 px-1.5 py-0.5 rounded">
                          Master Model
                        </span>
                        <span className="truncate">{m.name} (General / Fleet)</span>
                      </div>
                      {isMasterSelected && <IconCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                    </button>

                    {/* Physical Units Sub-List */}
                    {units && units.length > 0 && (
                      <div className="mt-1 pl-2 space-y-0.5 border-l-2 border-gray-100 ml-3">
                        {units.map((u: any) => {
                          const unitVal = `${m.name} (${u.serial_id})`;
                          const isUnitSelected = value === unitVal;
                          const isDamaged =
                            u.condition === 'In Repair' ||
                            u.condition === 'Needs Inspection' ||
                            u.status === 'Maintenance / Repair';

                          return (
                            <button
                              key={u.serial_id}
                              type="button"
                              onClick={() => handleSelect(unitVal)}
                              className={`w-full text-left px-2 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isUnitSelected
                                  ? 'bg-sky-50 text-sky-700 font-bold'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200/60">
                                  {u.serial_id}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold truncate ${
                                    isDamaged ? 'text-amber-700' : 'text-gray-500'
                                  }`}
                                >
                                  {u.condition || 'Good'}
                                </span>
                                {u.status && (
                                  <span className="text-[9px] text-gray-400 hidden sm:inline truncate">
                                    • {u.status}
                                  </span>
                                )}
                              </div>
                              {isUnitSelected && <IconCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconAlertTriangle({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function IconWrench({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

function IconDollarSign({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12c-1.11 0-2.08-.402-2.599-1M12 18v-2"
      />
    </svg>
  );
}

export interface InventoryAlertItem {
  id: string;
  type: string; // 'Lost / Missing Gear', 'Hardware Damage', 'Torn / Broken Cable', 'Maintenance Required'
  category: 'Incident' | 'Maintenance';
  gear: string;
  details: string;
  severity: 'High' | 'Medium' | 'Low';
  date: string;
  modelId?: string;
  serialId?: string;
  isCustomAlert?: boolean;
  // Post-Event Incident Specific Fields
  bookingId?: string;
  eventName?: string;
  clientName?: string;
  estimatedCost?: number;
  clientLiability?: 'Client Liable' | 'Company Absorbed' | 'Under Investigation';
  resolutionNotes?: string;
}

export default function InventoryAlertsPage({ go: _go }: { go: (p: Page) => void }) {
  const [alerts, setAlerts] = useState<InventoryAlertItem[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'incidents' | 'maintenance' | 'liable'>('all');
  const [severityFilter, setSeverityFilter] = useState('All');

  // Modals
  const [showAddIncidentModal, setShowAddIncidentModal] = useState(false);
  const [showAddMaintenanceModal, setShowAddMaintenanceModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedItemForResolve, setSelectedItemForResolve] = useState<InventoryAlertItem | null>(null);
  const [resolveOutcome, setResolveOutcome] = useState('');
  const [restoreUnitOperational, setRestoreUnitOperational] = useState(true);

  // Form State: Post-Event Incident Log
  const [incidentCategory, setIncidentCategory] = useState<'Lost / Missing Gear' | 'Hardware Damage' | 'Torn / Broken Cable' | 'Liquid Spill' | 'Electrical Fault'>('Lost / Missing Gear');
  const [targetType, setTargetType] = useState<'model_unit' | 'custom_accessory'>('model_unit');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [customAccessoryName, setCustomAccessoryName] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [eventName, setEventName] = useState('');
  const [clientName, setClientName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<string>('3500');
  const [clientLiability, setClientLiability] = useState<'Client Liable' | 'Company Absorbed' | 'Under Investigation'>('Client Liable');
  const [incidentSeverity, setIncidentSeverity] = useState<'High' | 'Medium' | 'Low'>('High');
  const [incidentDetails, setIncidentDetails] = useState('');

  // Form State: Bench Maintenance Alert
  const [maintTarget, setMaintTarget] = useState('');
  const [maintType, setMaintType] = useState('Maintenance Required');
  const [maintSeverity, setMaintSeverity] = useState<'High' | 'Medium' | 'Low'>('High');
  const [maintDetails, setMaintDetails] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Notification State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4500);
  };

  // =========================================================================
  // SUPABASE READ (FETCH MODELS, PHYSICAL UNITS, BOOKINGS & ALERTS)
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
      setEquipmentModels(modelsData || []);

      // 2. Fetch recent bookings for incident linking
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, event_name, customer_name, event_date, status')
        .order('event_date', { ascending: false })
        .limit(40);
      setRecentBookings(bookingsData || []);

      // 3. Fetch active custom maintenance & incident alerts
      const { data: customAlertsData, error: alertsError } = await supabase
        .from('inventory_alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.warn('Custom alerts table fetch note:', alertsError);
      }

      // Helper to extract serial ID from gear string
      const extractSerialId = (str?: string) => {
        if (!str) return null;
        const match = str.match(/\(([^)]+)\)/);
        return match ? match[1].trim() : null;
      };

      const derivedAlerts: InventoryAlertItem[] = [];
      const activeCustomAlertSerials = new Set<string>();

      // 1. Process custom logged alerts from database with parsed incident attributes
      if (customAlertsData && customAlertsData.length > 0) {
        customAlertsData.forEach((ca: any) => {
          if (ca.alert_type !== 'Low Stock Warning') {
            let parsedDetails = ca.details || '';
            let extBookingId = ca.booking_id;
            let extEventName = ca.event_name;
            let extClientName = ca.client_name;
            let extCost = Number(ca.estimated_cost) || 0;
            let extLiability = ca.client_liability || undefined;

            // Check if details contains JSON metadata bundle
            if (parsedDetails.startsWith('__INCIDENT_PAYLOAD__:')) {
              try {
                const meta = JSON.parse(parsedDetails.replace('__INCIDENT_PAYLOAD__:', ''));
                parsedDetails = meta.notes || '';
                extBookingId = extBookingId || meta.bookingId;
                extEventName = extEventName || meta.eventName;
                extClientName = extClientName || meta.clientName;
                extCost = extCost || Number(meta.estimatedCost) || 0;
                extLiability = extLiability || meta.clientLiability;
              } catch (e) {}
            }

            const isIncident =
              ca.alert_type === 'Lost / Missing Gear' ||
              ca.alert_type === 'Hardware Damage' ||
              ca.alert_type === 'Hardware Damage Log' ||
              ca.alert_type === 'Torn / Broken Cable' ||
              ca.alert_type === 'Damage Incident' ||
              ca.alert_type === 'Liquid Spill' ||
              ca.alert_type === 'Electrical Fault' ||
              Boolean(extEventName || extCost > 0);

            const itemSerialId = ca.serial_id || extractSerialId(ca.gear_name) || undefined;
            if (itemSerialId) {
              activeCustomAlertSerials.add(itemSerialId.toLowerCase());
            }

            derivedAlerts.push({
              id: ca.id,
              type: ca.alert_type,
              category: isIncident ? 'Incident' : 'Maintenance',
              gear: ca.gear_name,
              details: parsedDetails,
              severity: (ca.severity as any) || 'High',
              date: ca.created_at ? ca.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              modelId: ca.model_id,
              serialId: itemSerialId,
              isCustomAlert: true,
              bookingId: extBookingId,
              eventName: extEventName,
              clientName: extClientName,
              estimatedCost: extCost,
              clientLiability: extLiability,
              resolutionNotes: ca.resolution_notes,
            });
          }
        });
      }

      // 2. Physical units flagged as requiring repair or decommissioned (deduplicating if custom alert already exists)
      if (modelsData && modelsData.length > 0) {
        modelsData.forEach((m: any) => {
          const units = m.units || [];

          units.forEach((u: any) => {
            if (
              u.condition === 'In Repair' ||
              u.condition === 'Needs Inspection' ||
              u.condition === 'Minor Wear' ||
              u.status === 'Maintenance / Repair' ||
              u.status === 'Decommissioned / Inactive'
            ) {
              // Skip if an explicit custom alert record already exists for this physical unit
              if (u.serial_id && activeCustomAlertSerials.has(u.serial_id.toLowerCase())) {
                return;
              }

              const isHigh = u.condition === 'In Repair' || u.status === 'Decommissioned / Inactive';
              const isLost = (u.notes || '').toLowerCase().includes('lost') || (u.status || '').toLowerCase().includes('inactive');

              derivedAlerts.push({
                id: `unit-${u.serial_id}`,
                type: isLost ? 'Lost / Missing Gear' : u.condition === 'In Repair' ? 'Hardware Damage' : 'Maintenance Required',
                category: isLost || u.condition === 'In Repair' ? 'Incident' : 'Maintenance',
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

  // Sync event & client names when booking is selected in modal
  const handleBookingSelect = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    if (!bookingId) {
      setEventName('');
      setClientName('');
      return;
    }
    const b = recentBookings.find((item) => item.id === bookingId);
    if (b) {
      setEventName(b.event_name || 'Production Event');
      setClientName(b.customer_name || 'Event Host');
    }
  };

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
  // CREATE POST-EVENT DAMAGE / LOST EQUIPMENT INCIDENT LOG
  // =========================================================================
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDetails.trim()) return;

    setIsSubmitting(true);
    const gearDisplayName =
      targetType === 'custom_accessory'
        ? customAccessoryName.trim() || 'Accessory Item'
        : selectedTarget || (equipmentModels[0]?.name ? `${equipmentModels[0].name}` : 'General Equipment');

    const costValue = Math.max(0, parseFloat(estimatedCost) || 0);

    // Encode JSON metadata bundle for resilient cross-schema support
    const metadataBundle = JSON.stringify({
      bookingId: selectedBookingId || null,
      eventName: eventName.trim() || null,
      clientName: clientName.trim() || null,
      estimatedCost: costValue,
      clientLiability,
      notes: incidentDetails.trim(),
    });

    const fullDetailsPayload = `__INCIDENT_PAYLOAD__:${metadataBundle}`;

    try {
      // 1. Attempt insert with extended columns, fallback to base columns if needed
      const primaryPayload: any = {
        alert_type: incidentCategory,
        severity: incidentSeverity,
        gear_name: gearDisplayName,
        details: fullDetailsPayload,
        status: 'active',
        booking_id: selectedBookingId || null,
        event_name: eventName.trim() || null,
        client_name: clientName.trim() || null,
        estimated_cost: costValue,
        client_liability: clientLiability,
      };

      const { error: alertInsertError } = await supabase.from('inventory_alerts').insert(primaryPayload);

      if (alertInsertError) {
        // Fallback without extended column definitions if table schema is default
        await supabase.from('inventory_alerts').insert({
          alert_type: incidentCategory,
          severity: incidentSeverity,
          gear_name: gearDisplayName,
          details: fullDetailsPayload,
          status: 'active',
        });
      }

      // 2. If target is a physical unit serial tag, update unit status in physical_units table
      if (selectedTarget.includes('(') && selectedTarget.includes(')')) {
        const serialTagMatch = selectedTarget.match(/\(([^)]+)\)/);
        const serialTag = serialTagMatch ? serialTagMatch[1] : null;

        if (serialTag) {
          const isLost = incidentCategory === 'Lost / Missing Gear';
          const newCondition = isLost ? 'Needs Inspection' : 'In Repair';
          const newStatus = isLost ? 'Decommissioned / Inactive' : 'Maintenance / Repair';

          await supabase
            .from('physical_units')
            .update({
              condition: newCondition,
              status: newStatus,
              notes: `[INCIDENT - ${incidentCategory}] ${incidentDetails.trim()} | Est: ₱${costValue.toLocaleString()} (${clientLiability})`,
              last_maintenance: new Date().toISOString().split('T')[0],
            })
            .eq('serial_id', serialTag);
        }
      }

      await logAuditToSupabase(
        'POST_EVENT_INCIDENT_LOGGED',
        gearDisplayName,
        `Logged ${incidentCategory} incident: ${gearDisplayName}. Est. Cost: ₱${costValue.toLocaleString()} (${clientLiability}). Event: ${eventName || 'N/A'}`
      );

      await fetchAlertsAndInventory();
      setShowAddIncidentModal(false);
      setIncidentDetails('');
      setCustomAccessoryName('');
      showSuccess(`Damage / incident logged for "${gearDisplayName}" (${incidentCategory}).`);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.warn('Create incident error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // CREATE BENCH MAINTENANCE ALERT
  // =========================================================================
  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintDetails.trim()) return;

    setIsSubmitting(true);
    const gearDisplayName = maintTarget || (equipmentModels[0]?.name ? `${equipmentModels[0].name}` : 'General Equipment');

    try {
      await supabase.from('inventory_alerts').insert({
        alert_type: maintType,
        severity: maintSeverity,
        gear_name: gearDisplayName,
        details: maintDetails.trim(),
        status: 'active',
      });

      if (maintTarget.includes('(') && maintTarget.includes(')')) {
        const serialTagMatch = maintTarget.match(/\(([^)]+)\)/);
        const serialTag = serialTagMatch ? serialTagMatch[1] : null;

        if (serialTag) {
          const newCondition = maintType === 'Hardware Damage' ? 'In Repair' : 'Needs Inspection';
          await supabase
            .from('physical_units')
            .update({
              condition: newCondition,
              notes: maintDetails.trim(),
              last_maintenance: new Date().toISOString().split('T')[0],
            })
            .eq('serial_id', serialTag);
        }
      }

      await logAuditToSupabase(
        'CREATE_MAINTENANCE_ALERT',
        gearDisplayName,
        `Logged ${maintSeverity} priority maintenance: ${maintType} (${maintDetails.trim()})`
      );

      await fetchAlertsAndInventory();
      setShowAddMaintenanceModal(false);
      setMaintDetails('');
      showSuccess(`Bench maintenance alert logged for "${gearDisplayName}".`);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.warn('Create maintenance alert error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // RESOLVE ALERT / INCIDENT
  // =========================================================================
  const handleResolveConfirm = async () => {
    if (!selectedItemForResolve) return;
    setIsSubmitting(true);

    const item = selectedItemForResolve;
    try {
      const targetSerialId = item.serialId || (item.gear?.match(/\(([^)]+)\)/)?.[1]?.trim());

      // 1. If physical serial unit, restore condition if requested
      if (targetSerialId && restoreUnitOperational) {
        await supabase
          .from('physical_units')
          .update({
            condition: 'Operational (Good)',
            status: 'Available in Warehouse',
            last_maintenance: new Date().toISOString().split('T')[0],
            notes: resolveOutcome ? `Resolved: ${resolveOutcome}` : null,
          })
          .eq('serial_id', targetSerialId);
      }

      // 2. Update custom alert in inventory_alerts table
      if (item.isCustomAlert) {
        try {
          await supabase
            .from('inventory_alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_notes: resolveOutcome || 'Resolved by inventory manager',
            })
            .eq('id', item.id);
        } catch (e) {
          await supabase
            .from('inventory_alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
      } else if (targetSerialId) {
        try {
          await supabase
            .from('inventory_alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_notes: resolveOutcome || 'Resolved by inventory manager',
            })
            .eq('status', 'active')
            .ilike('gear_name', `%${targetSerialId}%`);
        } catch (e) {}
      }

      await logAuditToSupabase(
        'RESOLVE_INCIDENT_ALERT',
        item.serialId || item.modelId || item.id,
        `Resolved incident for ${item.gear}. Outcome: ${resolveOutcome || 'Operational restored'}`
      );

      setAlerts((prev) => prev.filter((a) => a.id !== item.id));
      setShowResolveModal(false);
      setSelectedItemForResolve(null);
      setResolveOutcome('');
      showSuccess(`Incident / maintenance alert for "${item.gear}" marked as resolved.`);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.warn('Resolve error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // COMPUTED KPI METRICS
  // =========================================================================
  const totalIncidentsCount = alerts.filter((a) => a.category === 'Incident').length;
  const totalMaintenanceCount = alerts.filter((a) => a.category === 'Maintenance').length;
  const totalReplacementCost = alerts.reduce((sum, a) => sum + (a.estimatedCost || 0), 0);
  const clientLiableCost = alerts
    .filter((a) => a.clientLiability === 'Client Liable')
    .reduce((sum, a) => sum + (a.estimatedCost || 0), 0);

  // Filtered Items
  const filteredAlerts = alerts.filter((a) => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'incidents' && a.category === 'Incident') ||
      (activeTab === 'maintenance' && a.category === 'Maintenance') ||
      (activeTab === 'liable' && a.clientLiability === 'Client Liable');

    const matchesSev = severityFilter === 'All' || a.severity === severityFilter;

    const matchesSearch =
      a.gear.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      a.details.toLowerCase().includes(search.toLowerCase()) ||
      (a.eventName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.clientName || '').toLowerCase().includes(search.toLowerCase());

    return matchesTab && matchesSev && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Equipment Incident & Maintenance Hub</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Damage & Lost Equipment Incident Log
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1 max-w-2xl">
            Post-event incident tracking for missing microphones, broken cables, damaged hardware, estimated replacement costs, and client liability billing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowAddIncidentModal(true)}
            className="bg-rose-600 text-white text-xs font-bold px-4.5 py-2.5 rounded-full hover:bg-rose-700 transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <IconAlertTriangle className="w-4 h-4" /> Log Damage / Lost Gear
          </button>
          <button
            onClick={() => setShowAddMaintenanceModal(true)}
            className="bg-[var(--ink)] text-white text-xs font-bold px-4.5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <IconWrench className="w-4 h-4" /> Log Bench Maintenance
          </button>
        </div>
      </div>

      {/* Operation Success Notification Banner */}
      {successMessage && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCheck className="w-3.5 h-3.5 text-emerald-700" />
            </span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-full hover:bg-emerald-100/50 cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metrics Dashboard Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#24252c]/50 uppercase tracking-wider">Active Incidents</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--ink)] mt-2">{totalIncidentsCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">Post-event damage & lost gear</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#24252c]/50 uppercase tracking-wider">Est. Replacement Cost</span>
            <IconDollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--ink)] mt-2">₱{totalReplacementCost.toLocaleString()}</p>
          <span className="text-[10px] text-amber-600 font-medium">Total replacement & repair value</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#24252c]/50 uppercase tracking-wider">Client Liable Value</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">Billable</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">₱{clientLiableCost.toLocaleString()}</p>
          <span className="text-[10px] text-[#24252c]/50">Chargeable to client / deposit</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#24252c]/50 uppercase tracking-wider">Bench Maintenance</span>
            <IconWrench className="w-4 h-4 text-[#1090F8]" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--ink)] mt-2">{totalMaintenanceCount}</p>
          <span className="text-[10px] text-[#1090F8] font-medium">In-house inspections & repairs</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Category Tab Selector */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {[
            { key: 'all', label: `All Alerts (${alerts.length})` },
            { key: 'incidents', label: `Damage & Lost Reports (${totalIncidentsCount})` },
            { key: 'liable', label: `Client Liable (${alerts.filter((a) => a.clientLiability === 'Client Liable').length})` },
            { key: 'maintenance', label: `Bench Maintenance (${totalMaintenanceCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#24252c]/50 font-semibold mr-1">Severity:</span>
            {['All', 'High', 'Medium', 'Low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-[#1090F8] text-white shadow-xs font-semibold'
                    : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gear, event, client..."
              className={inputClass + ' pl-10'}
            />
          </div>
        </div>
      </div>

      {/* Incidents & Alerts List */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-xs text-[#24252c]/50 border border-[#24252c]/[0.08]">
          Fetching incident and maintenance logs from database...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm p-8 text-center">
          <EmptyState
            icon={IconShield}
            title="No Active Incident or Maintenance Reports"
            description="No damage incidents or repair alerts match your active filter. All warehouse units and accessories are accounted for."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((item) => {
            const isLost = item.type === 'Lost / Missing Gear';
            const isDamage = item.type === 'Hardware Damage' || item.type === 'Torn / Broken Cable' || item.type === 'Damage Incident';

            return (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm hover:border-amber-500/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category / Type Badge */}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                        isLost
                          ? 'bg-rose-500/10 text-rose-700 border-rose-500/25'
                          : isDamage
                          ? 'bg-amber-500/10 text-amber-700 border-amber-500/25'
                          : 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/25'
                      }`}
                    >
                      {item.type}
                    </span>

                    {/* Severity Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        item.severity === 'High'
                          ? 'bg-rose-100 text-rose-800'
                          : item.severity === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.severity} Priority
                    </span>

                    {/* Client Liability Tag if available */}
                    {item.clientLiability && (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          item.clientLiability === 'Client Liable'
                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                            : item.clientLiability === 'Company Absorbed'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-500/10 text-amber-800 border-amber-500/20'
                        }`}
                      >
                        Liability: {item.clientLiability}
                      </span>
                    )}

                    <span className="text-[11px] text-[#24252c]/40">• Logged {item.date}</span>
                  </div>

                  {/* Gear Title */}
                  <h3 className="font-extrabold text-lg text-[var(--ink)]">{item.gear}</h3>

                  {/* Event & Client Details */}
                  {(item.eventName || item.clientName) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/70 bg-[var(--mist)] px-3 py-1.5 rounded-xl inline-flex">
                      {item.eventName && (
                        <span>
                          <strong className="text-[var(--ink)]">Event:</strong> {item.eventName}
                        </span>
                      )}
                      {item.clientName && (
                        <span>
                          <strong className="text-[var(--ink)]">Client:</strong> {item.clientName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description / Incident Notes */}
                  <p className="text-xs text-[#24252c]/70 leading-relaxed max-w-3xl">{item.details}</p>

                  {/* Cost & Recovery Summary */}
                  {Boolean(item.estimatedCost && item.estimatedCost > 0) && (
                    <div className="pt-1 flex items-center gap-4 text-xs font-semibold">
                      <span className="text-[var(--ink)]">
                        Est. Replacement / Repair Cost:{' '}
                        <span className="text-rose-600 font-extrabold">₱{item.estimatedCost?.toLocaleString()}</span>
                      </span>
                      {item.clientLiability === 'Client Liable' && (
                        <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                          <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Chargeable to Client / Deductible from Security Deposit</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#24252c]/[0.06]">
                  <button
                    onClick={() => {
                      setSelectedItemForResolve(item);
                      setResolveOutcome('');
                      setShowResolveModal(true);
                    }}
                    className="bg-[#1090F8] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <IconCheck className="w-3.5 h-3.5" /> Resolve & Close Log
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: LOG POST-EVENT DAMAGE / LOST EQUIPMENT INCIDENT                   */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={showAddIncidentModal} onClose={() => setShowAddIncidentModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowAddIncidentModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Post-Event Incident Report</span>
          </div>

          <h3 className="text-xl font-extrabold text-[var(--ink)]">
            Log Damage / Lost Equipment
          </h3>
          <p className="text-xs text-[#24252c]/50 mb-5">
            Record missing gear (e.g. mic, receiver), broken cables, or damaged stage fixtures post-event, with replacement cost and client liability.
          </p>

          <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
            {/* Event Connection */}
            <div className="p-3.5 bg-[var(--mist)] rounded-2xl space-y-3">
              <label className="font-bold uppercase text-[#24252c]/60 block text-[11px]">
                1. Connect to Event / Booking
              </label>

              <div>
                <select
                  value={selectedBookingId}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  className={inputClass + ' font-semibold py-2.5 bg-white'}
                >
                  <option value="">Select from Recent Bookings (or enter manual event below)...</option>
                  {recentBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.event_date} — {b.event_name} ({b.customer_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-[#24252c]/50 block mb-1">Event Name</label>
                  <input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Cruz-Santos Wedding"
                    className={inputClass + ' bg-white'}
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#24252c]/50 block mb-1">Client / Organizer</label>
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className={inputClass + ' bg-white'}
                  />
                </div>
              </div>
            </div>

            {/* Incident Classification */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Incident Category
                </label>
                <select
                  value={incidentCategory}
                  onChange={(e) => setIncidentCategory(e.target.value as any)}
                  className={inputClass + ' font-semibold py-2.5'}
                >
                  <option value="Lost / Missing Gear">Lost / Missing Equipment</option>
                  <option value="Hardware Damage">Hardware Damage (Dropped / Cracked)</option>
                  <option value="Torn / Broken Cable">Torn / Damaged Cable</option>
                  <option value="Liquid Spill">Liquid Spill / Water Damage</option>
                  <option value="Electrical Fault">Electrical Fault / Blown Component</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Urgency / Severity
                </label>
                <select
                  value={incidentSeverity}
                  onChange={(e) => setIncidentSeverity(e.target.value as any)}
                  className={inputClass + ' font-semibold py-2.5'}
                >
                  <option value="High">High (Immediate Replacement Needed)</option>
                  <option value="Medium">Medium (Affects Next Booking)</option>
                  <option value="Low">Low (Spare Available)</option>
                </select>
              </div>
            </div>

            {/* Target Gear Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold uppercase text-[#24252c]/50 text-[11px]">
                  Affected Equipment / Accessory
                </label>
                <div className="flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'model_unit'}
                      onChange={() => setTargetType('model_unit')}
                    />
                    Registered Gear
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'custom_accessory'}
                      onChange={() => setTargetType('custom_accessory')}
                    />
                    Custom Accessory (Cable/Mic/Stand)
                  </label>
                </div>
              </div>

              {targetType === 'model_unit' ? (
                <SearchableEquipmentSelect
                  equipmentModels={equipmentModels}
                  value={selectedTarget}
                  onChange={setSelectedTarget}
                  placeholder="Search model, brand, or serial ID (e.g. MIC-001)..."
                />
              ) : (
                <input
                  value={customAccessoryName}
                  onChange={(e) => setCustomAccessoryName(e.target.value)}
                  placeholder="e.g. Shure SM58 Wireless Handheld Mic #2, Canare 20m XLR Cable, Speaker Stand"
                  className={inputClass}
                  required
                />
              )}
            </div>

            {/* Cost & Liability Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/50">
              <div>
                <label className="font-bold text-amber-900 uppercase block mb-1 text-[11px]">
                  Estimated Replacement Cost (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-500">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="3500"
                    className={inputClass + ' pl-8 bg-white font-bold text-rose-600'}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-amber-900 uppercase block mb-1 text-[11px]">
                  Client Liability Determination
                </label>
                <select
                  value={clientLiability}
                  onChange={(e) => setClientLiability(e.target.value as any)}
                  className={inputClass + ' bg-white font-semibold py-2.5'}
                >
                  <option value="Client Liable">Client Liable (Charge to Host)</option>
                  <option value="Company Absorbed">Company Absorbed (Wear & Tear)</option>
                  <option value="Under Investigation">Under Investigation / Discussion</option>
                </select>
              </div>
            </div>

            {/* Description / Post Event Notes */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Incident Description & On-Site Circumstances
              </label>
              <textarea
                rows={3}
                value={incidentDetails}
                onChange={(e) => setIncidentDetails(e.target.value)}
                placeholder="Describe what happened on site (e.g. Guest dropped wireless mic during toast, dented mesh grill & cracked cartridge. Missing after pack-up...)"
                className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-rose-600 text-white font-semibold py-3.5 rounded-full hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? 'Submitting Incident...' : 'Save Damage / Lost Incident Log'}
            </button>
          </form>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* MODAL 2: LOG BENCH MAINTENANCE ALERT                                      */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={showAddMaintenanceModal} onClose={() => setShowAddMaintenanceModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowAddMaintenanceModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">
            Log Bench Maintenance Alert
          </h3>
          <p className="text-xs text-[#24252c]/50 mb-4">
            Input workshop inspection notes, routine maintenance checks, or diagnostic repair tasks.
          </p>

          <form onSubmit={handleCreateMaintenance} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Target Equipment Model / Serial Unit
              </label>
              <SearchableEquipmentSelect
                equipmentModels={equipmentModels}
                value={maintTarget}
                onChange={setMaintTarget}
                placeholder="Search model, brand, or serial ID (e.g. SPK-001)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Alert Category
                </label>
                <select
                  value={maintType}
                  onChange={(e) => setMaintType(e.target.value)}
                  className={inputClass + ' font-semibold py-3'}
                >
                  <option value="Maintenance Required">Maintenance Required</option>
                  <option value="Routine Inspection">Routine Inspection / Testing</option>
                  <option value="Hardware Damage">Hardware Damage</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Severity
                </label>
                <select
                  value={maintSeverity}
                  onChange={(e) => setMaintSeverity(e.target.value as any)}
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
                Diagnostic Notes / Maintenance Required
              </label>
              <textarea
                rows={3}
                value={maintDetails}
                onChange={(e) => setMaintDetails(e.target.value)}
                placeholder="Describe crackling audio, blown bulb, worn XLR jack, firmware update needed..."
                className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Log Bench Maintenance Record'}
            </button>
          </form>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* MODAL 3: RESOLVE & CLOSE INCIDENT / ALERT                                  */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={showResolveModal} onClose={() => setShowResolveModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowResolveModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Resolve & Settle</span>
          </div>

          <h3 className="text-xl font-extrabold text-[var(--ink)]">
            Close Incident / Alert
          </h3>
          <p className="text-xs text-[#24252c]/50 mb-4">
            Mark item as repaired, client billed, or replaced in warehouse inventory.
          </p>

          {selectedItemForResolve && (
            <div className="p-3 bg-[var(--mist)] rounded-2xl mb-4 text-xs space-y-1">
              <p className="font-extrabold text-[var(--ink)]">{selectedItemForResolve.gear}</p>
              <p className="text-[#24252c]/60">{selectedItemForResolve.details}</p>
              {selectedItemForResolve.estimatedCost ? (
                <p className="font-bold text-rose-600">
                  Est. Cost: ₱{selectedItemForResolve.estimatedCost.toLocaleString()} ({selectedItemForResolve.clientLiability})
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Resolution Settlement & Action Notes
              </label>
              <textarea
                rows={3}
                value={resolveOutcome}
                onChange={(e) => setResolveOutcome(e.target.value)}
                placeholder="e.g. Client reimbursed ₱3,500. Replacement mic unit ordered. / XLR cable resoldered and bench tested OK."
                className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
              />
            </div>

            {selectedItemForResolve?.serialId && (
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#24252c]/80">
                <input
                  type="checkbox"
                  checked={restoreUnitOperational}
                  onChange={(e) => setRestoreUnitOperational(e.target.checked)}
                  className="rounded text-[#1090F8]"
                />
                Restore serial unit status to Operational & Available in Warehouse
              </label>
            )}

            <button
              type="button"
              onClick={handleResolveConfirm}
              disabled={isSubmitting}
              className="w-full bg-[#1090F8] text-white font-semibold py-3.5 rounded-full hover:bg-[#1090F8]/90 transition-colors cursor-pointer disabled:opacity-50 shadow-md flex items-center justify-center gap-1.5"
            >
              <IconCheck className="w-4 h-4" />
              {isSubmitting ? 'Updating Database...' : 'Confirm Resolution & Mark Resolved'}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
