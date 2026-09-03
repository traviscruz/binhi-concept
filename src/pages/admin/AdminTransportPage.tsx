import { useState, useEffect, useRef } from 'react';
import type { Page } from '../../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconPlus, IconX, IconTrash, IconSearch, IconCheck, IconPin } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../utils/auditLogger';
import {
  fetchLogisticsConfig,
  saveLogisticsConfig,
  type LogisticsConfig,
  DEFAULT_LOGISTICS_CONFIG,
} from '../../utils/logistics';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TransportRule {
  id: string;
  region: string;
  baseFee: number;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

interface PsgcRegion {
  code: string;
  name: string;
  regionName: string;
}

interface PsgcProvince {
  code: string;
  name: string;
  regionCode: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminTransportPage({ go: _go }: { go: (p: Page) => void }) {
  const [rules, setRules] = useState<TransportRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Logistics Warehouse & Proximity Waiver State ─────────────────────────────
  const [logistics, setLogistics] = useState<LogisticsConfig>(DEFAULT_LOGISTICS_CONFIG);
  const [tempLogistics, setTempLogistics] = useState<LogisticsConfig>(DEFAULT_LOGISTICS_CONFIG);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [loadingLogistics, setLoadingLogistics] = useState(true);
  const [savingLogistics, setSavingLogistics] = useState(false);
  const [logisticsSavedToast, setLogisticsSavedToast] = useState(false);
  const warehouseMapContainer = useRef<HTMLDivElement | null>(null);
  const warehouseMapInstance = useRef<L.Map | null>(null);
  const warehouseMarkerRef = useRef<L.Marker | null>(null);
  const warehouseCircleRef = useRef<L.Circle | null>(null);

  // Warehouse Address Search Autocomplete States
  const [isSearchingWarehouseAddress, setIsSearchingWarehouseAddress] = useState(false);
  const [warehouseAddressSuggestions, setWarehouseAddressSuggestions] = useState<
    Array<{ display_name: string; lat: string; lon: string }>
  >([]);
  const [showWarehouseAddressDropdown, setShowWarehouseAddressDropdown] = useState(false);
  const warehouseSearchDebounceRef = useRef<any>(null);
  const warehouseDropdownRef = useRef<HTMLDivElement | null>(null);

  // Warehouse Address Search Autocomplete (Debounced)
  const handleWarehouseAddressInputChange = (val: string) => {
    setTempLogistics((prev) => ({ ...prev, warehouseAddress: val }));

    if (warehouseSearchDebounceRef.current) {
      clearTimeout(warehouseSearchDebounceRef.current);
    }

    if (!val || val.trim().length < 3) {
      setWarehouseAddressSuggestions([]);
      setShowWarehouseAddressDropdown(false);
      return;
    }

    warehouseSearchDebounceRef.current = setTimeout(async () => {
      setIsSearchingWarehouseAddress(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=ph&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en-PH, en',
            },
          }
        );
        if (res.ok) {
          const items = await res.json();
          setWarehouseAddressSuggestions(items || []);
          setShowWarehouseAddressDropdown(Boolean(items && items.length > 0));
        }
      } catch (e) {
        console.error('Warehouse address search error:', e);
      } finally {
        setIsSearchingWarehouseAddress(false);
      }
    }, 400);
  };

  // Select suggestion from dropdown
  const handleSelectWarehouseSuggestion = (item: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setTempLogistics((prev) => ({
      ...prev,
      warehouseAddress: item.display_name,
      warehouseLat: Number(lat.toFixed(6)),
      warehouseLng: Number(lng.toFixed(6)),
    }));
    setShowWarehouseAddressDropdown(false);

    if (warehouseMapInstance.current && warehouseMarkerRef.current && warehouseCircleRef.current) {
      warehouseMapInstance.current.flyTo([lat, lng], 15, { duration: 1.2 });
      warehouseMarkerRef.current.setLatLng([lat, lng]);
      warehouseCircleRef.current.setLatLng([lat, lng]);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(e.target as Node)) {
        setShowWarehouseAddressDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal States - Add Rule
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRegion, setNewRegion] = useState('');
  const [newFee, setNewFee] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Modal States - Edit Rule
  const [editingRule, setEditingRule] = useState<TransportRule | null>(null);
  const [editRegion, setEditRegion] = useState('');
  const [editFeeVal, setEditFeeVal] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm State
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // PSGC API Picker States (Region and Province only)
  const [psgcRegions, setPsgcRegions] = useState<PsgcRegion[]>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<PsgcProvince[]>([]);
  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);

  // Active target for PSGC picker ('add' or 'edit')
  const [psgcTarget, setPsgcTarget] = useState<'add' | 'edit'>('add');

  // ── Fetch Logistics Config ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadLogistics() {
      setLoadingLogistics(true);
      try {
        const config = await fetchLogisticsConfig();
        setLogistics(config);
        setTempLogistics(config);
      } catch (err) {
        console.error('Failed to load logistics config:', err);
      } finally {
        setLoadingLogistics(false);
      }
    }
    loadLogistics();
  }, []);

  // ── Initialize Warehouse Pinning Map (Inside Modal) ────────────────────────
  useEffect(() => {
    if (!showWarehouseModal) {
      if (warehouseMapInstance.current) {
        warehouseMapInstance.current.remove();
        warehouseMapInstance.current = null;
        warehouseMarkerRef.current = null;
        warehouseCircleRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!warehouseMapContainer.current) return;

      if (warehouseMapInstance.current) {
        warehouseMapInstance.current.remove();
        warehouseMapInstance.current = null;
      }

      const initialLat = tempLogistics.warehouseLat || DEFAULT_LOGISTICS_CONFIG.warehouseLat;
      const initialLng = tempLogistics.warehouseLng || DEFAULT_LOGISTICS_CONFIG.warehouseLng;

      const map = L.map(warehouseMapContainer.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const warehouseIcon = L.divIcon({
        className: 'binhi-warehouse-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; transform: translate(-50%, -100%);">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background: rgba(16, 144, 248, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background: #0c162c; border: 2.5px solid #1090F8; box-shadow: 0 8px 20px -2px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: warehouseIcon,
        draggable: true,
      }).addTo(map);

      // Free delivery radius circle
      const radiusMeters = (tempLogistics.freeRadiusKm || 2) * 1000;
      const circle = L.circle([initialLat, initialLng], {
        radius: radiusMeters,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: tempLogistics.isFreeRadiusEnabled ? 0.16 : 0.04,
        weight: 1.8,
        dashArray: tempLogistics.isFreeRadiusEnabled ? undefined : '5, 5',
      }).addTo(map);

      warehouseMapInstance.current = map;
      warehouseMarkerRef.current = marker;
      warehouseCircleRef.current = circle;

      // Reverse geocoding for warehouse address
      const reverseGeocodeWarehouse = async (lat: number, lng: number) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en-PH, en' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setTempLogistics((prev) => ({
                ...prev,
                warehouseAddress: data.display_name,
                warehouseLat: Number(lat.toFixed(6)),
                warehouseLng: Number(lng.toFixed(6)),
              }));
            }
          }
        } catch (e) {}
      };

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        setTempLogistics((prev) => ({
          ...prev,
          warehouseLat: Number(pos.lat.toFixed(6)),
          warehouseLng: Number(pos.lng.toFixed(6)),
        }));
        reverseGeocodeWarehouse(pos.lat, pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        setTempLogistics((prev) => ({
          ...prev,
          warehouseLat: Number(e.latlng.lat.toFixed(6)),
          warehouseLng: Number(e.latlng.lng.toFixed(6)),
        }));
        reverseGeocodeWarehouse(e.latlng.lat, e.latlng.lng);
      });

      map.invalidateSize();
    }, 180);

    return () => {
      clearTimeout(timer);
      if (warehouseMapInstance.current) {
        warehouseMapInstance.current.remove();
        warehouseMapInstance.current = null;
        warehouseMarkerRef.current = null;
        warehouseCircleRef.current = null;
      }
    };
  }, [showWarehouseModal]);

  // Update circle radius when freeRadiusKm or toggle changes in modal
  useEffect(() => {
    if (warehouseCircleRef.current) {
      warehouseCircleRef.current.setRadius((tempLogistics.freeRadiusKm || 2) * 1000);
      warehouseCircleRef.current.setStyle({
        fillOpacity: tempLogistics.isFreeRadiusEnabled ? 0.16 : 0.04,
        dashArray: tempLogistics.isFreeRadiusEnabled ? undefined : '5, 5',
      });
    }
  }, [tempLogistics.freeRadiusKm, tempLogistics.isFreeRadiusEnabled]);

  // ── Save Warehouse & Free Radius Rule ───────────────────────────────────────
  const handleSaveLogistics = async () => {
    setSavingLogistics(true);
    try {
      const saved = await saveLogisticsConfig(tempLogistics);
      setLogistics(saved);
      setTempLogistics(saved);
      setShowWarehouseModal(false);
      await logAuditEvent({
        action: 'UPDATE_WAREHOUSE_LOGISTICS',
        module: 'transport',
        targetId: 'warehouse-proximity-rule',
        targetName: saved.warehouseName,
        details: `Updated Warehouse Location & Proximity Waiver: ${saved.freeRadiusKm} km free transport radius (${saved.isFreeRadiusEnabled ? 'Active' : 'Disabled'}) at [${saved.warehouseLat}, ${saved.warehouseLng}]`,
        currentData: saved,
      });

      setLogisticsSavedToast(true);
      setTimeout(() => setLogisticsSavedToast(false), 3500);
    } catch (err) {
      console.error('Failed to save logistics settings:', err);
      alert('Failed to save warehouse logistics settings.');
    } finally {
      setSavingLogistics(false);
    }
  };
  // ── Fetch Rules from Supabase ──────────────────────────────────────────────
  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transport_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: TransportRule[] = (data ?? []).map((row: any) => ({
        id: row.id,
        region: row.region,
        baseFee: Number(row.base_fee ?? 0),
        status: row.status === 'Inactive' ? 'Inactive' : 'Active',
        createdAt: row.created_at,
      }));

      setRules(formatted);
    } catch (err) {
      console.error('Error fetching transport rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // ── Fetch PSGC Regions ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch('https://psgc.gitlab.io/api/regions.json');
        if (res.ok) {
          const data: PsgcRegion[] = await res.json();
          setPsgcRegions(data.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error('Failed to fetch PSGC regions:', err);
      }
    };
    fetchRegions();
  }, []);

  // Handle PSGC Region Selection
  const handleRegionSelect = async (regionCode: string) => {
    setSelectedRegionCode(regionCode);
    setSelectedProvinceCode('');
    setPsgcProvinces([]);

    if (!regionCode) {
      if (psgcTarget === 'add') setNewRegion('');
      else setEditRegion('');
      return;
    }

    const regObj = psgcRegions.find((r) => r.code === regionCode);
    const regLabel = regObj ? `${regObj.name} (${regObj.regionName})` : '';

    // Immediately update location preview to chosen region
    if (psgcTarget === 'add') setNewRegion(regLabel);
    else setEditRegion(regLabel);

    // Fetch Provinces for this region
    setLoadingProvinces(true);
    try {
      const res = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces.json`);
      if (res.ok) {
        const data: PsgcProvince[] = await res.json();
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setPsgcProvinces(sorted);
      }
    } catch (err) {
      console.error('Error loading provinces:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // Handle PSGC Province Selection
  const handleProvinceSelect = (provinceCode: string) => {
    setSelectedProvinceCode(provinceCode);
    const regObj = psgcRegions.find((r) => r.code === selectedRegionCode);
    const provObj = psgcProvinces.find((p) => p.code === provinceCode);

    if (provObj) {
      const label = `${provObj.name} (${regObj ? regObj.regionName : ''})`;
      if (psgcTarget === 'add') setNewRegion(label);
      else setEditRegion(label);
    } else if (regObj) {
      const label = `${regObj.name} (${regObj.regionName})`;
      if (psgcTarget === 'add') setNewRegion(label);
      else setEditRegion(label);
    }
  };

  // ── Digit-only Input Helper ────────────────────────────────────────────────
  const handleDigitsOnly = (val: string, setter: (v: string) => void) => {
    const digitsOnly = val.replace(/[^0-9]/g, '');
    setter(digitsOnly);
  };

  // ── Add New Transport Rule ─────────────────────────────────────────────────
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegion.trim()) return;
    const numericFee = Number(newFee) || 0;

    setIsSubmittingAdd(true);
    try {
      const { data, error } = await supabase
        .from('transport_rules')
        .insert([
          {
            region: newRegion.trim(),
            base_fee: numericFee,
            status: 'Active',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const created: TransportRule = {
        id: data.id,
        region: data.region,
        baseFee: Number(data.base_fee),
        status: 'Active',
        createdAt: data.created_at,
      };

      setRules((prev) => [created, ...prev]);
      await logAuditEvent({
        action: 'CREATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: data.id,
        targetName: data.region,
        details: `Created transport fee rule for "${data.region}" (Base Fee: ₱${numericFee.toLocaleString()})`,
        currentData: { region: data.region, baseFee: numericFee, status: 'Active' },
      });
      setShowAddModal(false);
      resetAddForm();
    } catch (err) {
      console.error('Failed to add transport rule:', err);
      alert('Failed to save transport rule to database.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const resetAddForm = () => {
    setNewRegion('');
    setNewFee('');
    setSelectedRegionCode('');
    setSelectedProvinceCode('');
    setPsgcProvinces([]);
    setPsgcTarget('add');
  };

  const openEditModal = async (rule: TransportRule) => {
    setEditingRule(rule);
    setEditRegion(rule.region);
    setEditFeeVal(rule.baseFee.toString());
    setPsgcTarget('edit');
    setSelectedRegionCode('');
    setSelectedProvinceCode('');
    setPsgcProvinces([]);

    if (!rule.region) return;
    const ruleText = rule.region.toLowerCase();

    // Ensure psgcRegions are loaded
    let regionsList = psgcRegions;
    if (regionsList.length === 0) {
      try {
        const res = await fetch('https://psgc.gitlab.io/api/regions.json');
        if (res.ok) {
          regionsList = await res.json();
          setPsgcRegions(regionsList.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {}
    }

    // 1. Try matching region first
    let matchedRegion = regionsList.find(
      (r) =>
        (r.name && ruleText.includes(r.name.toLowerCase())) ||
        (r.regionName && ruleText.includes(r.regionName.toLowerCase()))
    );

    setLoadingProvinces(true);
    try {
      if (matchedRegion) {
        setSelectedRegionCode(matchedRegion.code);
        const res = await fetch(`https://psgc.gitlab.io/api/regions/${matchedRegion.code}/provinces.json`);
        if (res.ok) {
          const provs: PsgcProvince[] = await res.json();
          const sorted = provs.sort((a, b) => a.name.localeCompare(b.name));
          setPsgcProvinces(sorted);

          const matchedProv = sorted.find((p) => ruleText.includes(p.name.toLowerCase()));
          if (matchedProv) {
            setSelectedProvinceCode(matchedProv.code);
          }
        }
      } else {
        // 2. If region tag wasn't in text (e.g. rule is just "Cavite"), search provinces across all regions
        for (const reg of regionsList) {
          const res = await fetch(`https://psgc.gitlab.io/api/regions/${reg.code}/provinces.json`);
          if (res.ok) {
            const provs: PsgcProvince[] = await res.json();
            const foundProv = provs.find((p) => ruleText.includes(p.name.toLowerCase()));
            if (foundProv) {
              const sorted = provs.sort((a, b) => a.name.localeCompare(b.name));
              setPsgcProvinces(sorted);
              setSelectedRegionCode(reg.code);
              setSelectedProvinceCode(foundProv.code);
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error prefilling location for edit:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // ── Edit Fee & Region ─────────────────────────────────────────────────────
  const handleSaveEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const numericFee = Number(editFeeVal) || 0;
    const finalRegion = editRegion.trim() || editingRule.region;
    setIsSubmittingEdit(true);

    try {
      const { error } = await supabase
        .from('transport_rules')
        .update({ region: finalRegion, base_fee: numericFee, updated_at: new Date().toISOString() })
        .eq('id', editingRule.id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? { ...r, region: finalRegion, baseFee: numericFee } : r))
      );

      const feeChanged = editingRule.baseFee !== numericFee;
      await logAuditEvent({
        action: 'UPDATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: editingRule.id,
        targetName: finalRegion,
        details: feeChanged
          ? `Updated transport base fee for "${finalRegion}" from ₱${editingRule.baseFee.toLocaleString()} to ₱${numericFee.toLocaleString()}`
          : `Updated transport coverage details for "${finalRegion}"`,
        previousData: { region: editingRule.region, baseFee: editingRule.baseFee },
        currentData: { region: finalRegion, baseFee: numericFee },
      });

      setEditingRule(null);
    } catch (err) {
      console.error('Failed to update transport rule:', err);
      alert('Failed to update rule in database.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ── Toggle Active Status ──────────────────────────────────────────────────
  const handleToggleStatus = async (rule: TransportRule) => {
    const nextStatus = rule.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase
        .from('transport_rules')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', rule.id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, status: nextStatus } : r))
      );

      await logAuditEvent({
        action: 'UPDATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: rule.id,
        targetName: rule.region,
        details: `Toggled transport rule "${rule.region}" status to ${nextStatus}`,
        previousData: { status: rule.status },
        currentData: { status: nextStatus },
      });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // ── Delete Rule ────────────────────────────────────────────────────────────
  const handleDeleteRule = async (id: string) => {
    const target = rules.find((r) => r.id === id);
    try {
      const { error } = await supabase.from('transport_rules').delete().eq('id', id);
      if (error) throw error;

      setRules((prev) => prev.filter((r) => r.id !== id));

      await logAuditEvent({
        action: 'DELETE_TRANSPORT_RULE',
        module: 'transport',
        targetId: id,
        targetName: target?.region || id,
        details: `Deleted transport fee rule for "${target?.region || id}"`,
        previousData: target ? { region: target.region, baseFee: target.baseFee } : null,
      });

      setDeletingRuleId(null);
    } catch (err) {
      console.error('Failed to delete transport rule:', err);
      alert('Failed to delete rule from database.');
    }
  };

  // ── Filtered Rules ─────────────────────────────────────────────────────────
  const filteredRules = rules.filter((r) =>
    r.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Logistics & Coverage</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Transportation Fee Rule Editor
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure regional delivery logistics transport rates and warehouse proximity waiver rules.
          </p>
        </div>

        <button
          onClick={() => {
            resetAddForm();
            setShowAddModal(true);
          }}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto cursor-pointer inline-flex items-center gap-1.5"
        >
          <IconPlus className="w-4 h-4" /> Add New Region Fee
        </button>
      </div>

      {/* ── Warehouse Origin & Proximity Waiver Quick Summary Card ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex items-center justify-center shrink-0 text-[#1090F8]">
            <IconPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ink)]">
                {logistics.warehouseName || 'Warehouse Origin & Local Waiver'}
              </h2>
              {logistics.isFreeRadiusEnabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Free Transportation: ≤ {logistics.freeRadiusKm} km Waived
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Waiver Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-[#24252c]/60 mt-0.5 max-w-xl line-clamp-1">
              {logistics.warehouseAddress || 'No address specified'} · Coordinates: [{logistics.warehouseLat}, {logistics.warehouseLng}]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {logisticsSavedToast && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 animate-fade-in flex items-center gap-1.5">
              <IconCheck className="w-3.5 h-3.5" /> Rule Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setTempLogistics(logistics);
              setShowWarehouseModal(true);
            }}
            className="bg-[var(--mist)] hover:bg-black/5 text-[var(--ink)] text-xs font-semibold px-4 py-2.5 rounded-full border border-[#24252c]/10 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <IconBox className="w-3.5 h-3.5 text-[#1090F8]" />
            Configure Warehouse & Waiver
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#24252c]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search region or location..."
            className={inputClass + ' pl-10'}
          />
        </div>
        <span className="text-xs text-[#24252c]/50 font-medium">
          {filteredRules.length} region{filteredRules.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#24252c]/40 font-medium animate-pulse">
            Loading regional transportation fee rules from database...
          </div>
        ) : filteredRules.length === 0 ? (
          <EmptyState
            title="No Regional Zones Configured"
            description="Click '+ Add New Region Fee' above to add transport rates for Philippines locations."
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                    <th className="py-3 px-3 font-semibold">Region / Location</th>
                    <th className="py-3 px-3 font-semibold">Base Transport Fee</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredRules.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--mist)] transition-colors">
                      <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{r.region}</td>
                      <td className="py-3.5 px-3 font-extrabold text-[#1090F8] text-sm">
                        ₱{r.baseFee.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleStatus(r)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase cursor-pointer border transition-colors ${
                            r.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                          }`}
                          title="Click to toggle status"
                        >
                          {r.status}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(r)}
                            className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                          >
                            Edit Fee
                          </button>
                          <button
                            onClick={() => setDeletingRuleId(r.id)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block sm:hidden space-y-3">
              {filteredRules.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)]">{r.region}</span>
                    <button
                      onClick={() => handleToggleStatus(r)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        r.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-gray-200 text-gray-600 border-gray-300'
                      }`}
                    >
                      {r.status}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#24252c]/70">
                    Base Transport Fee:{' '}
                    <strong className="text-[#1090F8] text-sm">₱{r.baseFee.toLocaleString()}</strong>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(r)}
                      className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full text-[var(--ink)] cursor-pointer"
                    >
                      Edit Fee
                    </button>
                    <button
                      onClick={() => setDeletingRuleId(r.id)}
                      className="p-2 rounded-full text-rose-500 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Edit Logistics Fee Modal (Identical Layout to Add Modal) ── */}
      <ModalOverlay isOpen={!!editingRule} onClose={() => setEditingRule(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setEditingRule(null)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Regional Transport Zone</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Select an official Philippine region or province, then specify the transport rate.
          </p>

          <form onSubmit={handleSaveEditFee} className="space-y-4 text-xs">
            {/* ── Location Selectors ── */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60 block">
                1. Select Location
              </span>

              {/* Step A: Region Select */}
              <div>
                <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                  Region <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedRegionCode}
                  onChange={(e) => handleRegionSelect(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                >
                  <option value="">-- Choose Region (Required) --</option>
                  {psgcRegions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.regionName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step B: Province Select (Required when available) */}
              {selectedRegionCode && psgcProvinces.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                    Province <span className="text-rose-500">*</span> {loadingProvinces && '(Loading...)'}
                  </label>
                  <select
                    required
                    value={selectedProvinceCode}
                    onChange={(e) => handleProvinceSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                  >
                    <option value="">-- Choose Province (Required) --</option>
                    {psgcProvinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {!selectedProvinceCode && (
                    <p className="text-[10px] text-rose-500 font-semibold ml-1 mt-1">
                      Notice: Selecting a province is required for this region.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Region / Location Name (Uneditable Preview) */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Region / Location Name
              </label>
              <input
                type="text"
                value={editRegion}
                readOnly
                placeholder="Selected location will appear here..."
                className="w-full rounded-full border border-transparent px-4 py-2.5 text-xs bg-[#E5E7EB] text-[var(--ink)] font-semibold cursor-not-allowed opacity-90 focus:outline-none"
                required
              />
            </div>

            {/* Base Transport Fee Input */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Base Transport Fee
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#1090F8] text-sm">
                  ₱
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editFeeVal}
                  onChange={(e) => handleDigitsOnly(e.target.value, setEditFeeVal)}
                  placeholder="e.g. 3500"
                  className={inputClass + ' font-bold text-[#1090F8] text-sm py-2.5 pl-8 pr-4'}
                  required
                />
              </div>
              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-1">
                Formatted rate: <strong className="text-[#1090F8]">₱{Number(editFeeVal || 0).toLocaleString()}</strong>
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-6 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit || !selectedRegionCode || (psgcProvinces.length > 0 && !selectedProvinceCode) || !editRegion.trim() || !editFeeVal.trim()}
                className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-7 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md"
              >
                {isSubmittingEdit ? 'Saving...' : 'Save Fee Changes'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ── Add Regional Zone Modal (Identical Layout to Edit Modal) ── */}
      <ModalOverlay isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowAddModal(false)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Add Regional Transport Zone</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Select an official Philippine region or province, then specify the transport rate.
          </p>

          <form onSubmit={handleAddRule} className="space-y-4 text-xs">

            {/* ── Location Selectors ── */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60 block">
                1. Select Location
              </span>

              {/* Step A: Region Select */}
              <div>
                <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                  Region <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedRegionCode}
                  onChange={(e) => handleRegionSelect(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                >
                  <option value="">-- Choose Region (Required) --</option>
                  {psgcRegions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.regionName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step B: Province Select (Required when available) */}
              {selectedRegionCode && psgcProvinces.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                    Province <span className="text-rose-500">*</span> {loadingProvinces && '(Loading...)'}
                  </label>
                  <select
                    required
                    value={selectedProvinceCode}
                    onChange={(e) => handleProvinceSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                  >
                    <option value="">-- Choose Province (Required) --</option>
                    {psgcProvinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {!selectedProvinceCode && (
                    <p className="text-[10px] text-rose-500 font-semibold ml-1 mt-1">
                      Notice: Selecting a province is required for this region.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Region Label Input (Uneditable preview) */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Region / Location Name
              </label>
              <input
                type="text"
                value={newRegion}
                readOnly
                placeholder="Selected location will appear here..."
                className="w-full rounded-full border border-transparent px-4 py-2.5 text-xs bg-[#E5E7EB] text-[var(--ink)] font-semibold cursor-not-allowed opacity-90 focus:outline-none"
                required
              />
            </div>

            {/* Base Fee Input */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Base Transport Fee
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#1090F8] text-sm">
                  ₱
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newFee}
                  onChange={(e) => handleDigitsOnly(e.target.value, setNewFee)}
                  placeholder="e.g. 3500"
                  className={inputClass + ' font-bold text-[#1090F8] text-sm py-2.5 pl-8 pr-4'}
                  required
                />
              </div>
              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-1">
                Formatted rate: <strong className="text-[#1090F8]">₱{Number(newFee || 0).toLocaleString()}</strong>
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd || !selectedRegionCode || (psgcProvinces.length > 0 && !selectedProvinceCode) || !newRegion.trim() || !newFee.trim()}
                className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-7 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md"
              >
                {isSubmittingAdd ? 'Saving...' : 'Create Transport Rule'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ── Delete Confirmation Modal ── */}
      <ModalOverlay isOpen={!!deletingRuleId} onClose={() => setDeletingRuleId(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 text-center">
          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-2">Delete Transport Rule?</h3>
          <p className="text-xs text-[#24252c]/60 mb-6">
            Are you sure you want to remove this regional fee rule from database?
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setDeletingRuleId(null)}
              className="px-5 py-2 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => deletingRuleId && handleDeleteRule(deletingRuleId)}
              className="bg-rose-600 text-white text-xs font-semibold px-6 py-2 rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer"
            >
              Delete Rule
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* ── Configure Warehouse Origin & Proximity Waiver Modal ── */}
      <ModalOverlay isOpen={showWarehouseModal} onClose={() => setShowWarehouseModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-[#24252c]/10 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowWarehouseModal(false)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8]">
                <IconPin className="w-4 h-4" />
              </span>
              <h3 className="text-xl font-extrabold text-[var(--ink)]">
                Warehouse Origin & Proximity Waiver Rule
              </h3>
            </div>
            <p className="text-xs text-[#24252c]/60">
              Pin the central warehouse location on the map and configure the distance radius where delivery transport fees are automatically waived to ₱0.00 during customer checkout.
            </p>
          </div>

          <div className="space-y-5">
            {/* ── Pill-Shaped Proximity Waiver & Radius Control Bar ── */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-4">
              {/* Row 1: Proximity Waiver Status Toggle Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#24252c]/[0.06]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                      Free Proximity Waiver
                    </span>
                    {tempLogistics.isFreeRadiusEnabled ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Enabled (₱0.00 Rate)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700 border border-gray-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        Waiver Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#24252c]/60 mt-0.5">
                    Automatically waive the transportation fee when the booking venue is within radius of the warehouse.
                  </p>
                </div>

                {/* Pill Segmented Toggle */}
                <div className="inline-flex rounded-full bg-[#E5E7EB] p-1 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTempLogistics((prev) => ({ ...prev, isFreeRadiusEnabled: true }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tempLogistics.isFreeRadiusEnabled
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempLogistics((prev) => ({ ...prev, isFreeRadiusEnabled: false }))}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      !tempLogistics.isFreeRadiusEnabled
                        ? 'bg-[var(--ink)] text-white shadow-xs'
                        : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                    }`}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {/* Row 2: Pill-Shaped Radius Distance Presets and Stepper */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-1.5">
                    Free Radius Distance Presets
                  </label>
                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1.0, 2.0, 3.0, 5.0, 10.0].map((preset) => {
                      const isSelected = tempLogistics.freeRadiusKm === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTempLogistics((prev) => ({ ...prev, freeRadiusKm: preset }))}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--ink)] text-white shadow-xs'
                              : 'bg-white text-[#24252c]/75 border border-[#24252c]/10 hover:border-[#24252c]/30 hover:bg-gray-50'
                          }`}
                        >
                          {preset} km
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Distance Pill Input with Stepper */}
                <div className="flex items-center gap-2 self-start md:self-end">
                  <span className="text-[11px] font-semibold text-[#24252c]/50 uppercase">Radius:</span>
                  <div className="inline-flex items-center rounded-full bg-white border border-[#24252c]/15 p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() =>
                        setTempLogistics((prev) => ({
                          ...prev,
                          freeRadiusKm: Math.max(0.5, Number((prev.freeRadiusKm - 0.5).toFixed(1))),
                        }))
                      }
                      className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-black/10 text-[var(--ink)] font-black flex items-center justify-center transition-colors cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="50"
                      value={tempLogistics.freeRadiusKm}
                      onChange={(e) =>
                        setTempLogistics((prev) => ({
                          ...prev,
                          freeRadiusKm: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                        }))
                      }
                      className="w-14 text-center text-xs font-extrabold text-[var(--ink)] focus:outline-none bg-transparent"
                    />
                    <span className="text-[11px] font-bold text-[#24252c]/40 pr-2">km</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTempLogistics((prev) => ({
                          ...prev,
                          freeRadiusKm: Number((prev.freeRadiusKm + 0.5).toFixed(1)),
                        }))
                      }
                      className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-black/10 text-[var(--ink)] font-black flex items-center justify-center transition-colors cursor-pointer text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Warehouse Facility Details & Searchable Address Bar */}
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                  Warehouse Facility Name
                </label>
                <input
                  type="text"
                  value={tempLogistics.warehouseName}
                  onChange={(e) =>
                    setTempLogistics((prev) => ({ ...prev, warehouseName: e.target.value }))
                  }
                  placeholder="e.g. BINHI Central Production Warehouse"
                  className={inputClass}
                />
              </div>

              {/* Searchable Warehouse Address with Live Autocomplete Suggestions */}
              <div className="relative" ref={warehouseDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold uppercase text-[#24252c]/50 text-[10px]">
                    Warehouse Address Search
                  </label>
                  {isSearchingWarehouseAddress && (
                    <span className="text-[10px] font-medium text-[#1090F8] flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
                      Searching address...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    value={tempLogistics.warehouseAddress}
                    onChange={(e) => handleWarehouseAddressInputChange(e.target.value)}
                    onFocus={() => {
                      if (warehouseAddressSuggestions.length > 0) setShowWarehouseAddressDropdown(true);
                    }}
                    placeholder="Search place, city, or landmark (e.g. Taguig, BGC, Makati)"
                    className={inputClass + ' pl-9 pr-8'}
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#24252c]/40 pointer-events-none">
                    <IconSearch className="w-3.5 h-3.5" />
                  </div>
                  {tempLogistics.warehouseAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempLogistics((prev) => ({ ...prev, warehouseAddress: '' }));
                        setShowWarehouseAddressDropdown(false);
                        setWarehouseAddressSuggestions([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#24252c]/40 hover:text-[var(--ink)] p-1 cursor-pointer"
                    >
                      <IconX className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showWarehouseAddressDropdown && warehouseAddressSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-[#24252c]/10 shadow-2xl overflow-hidden z-[999] animate-blur-in max-h-56 overflow-y-auto">
                    <div className="p-1.5 space-y-0.5">
                      <div className="px-2.5 py-1 text-[9px] font-bold text-[#24252c]/40 uppercase tracking-wider">
                        Suggested Locations (Philippines)
                      </div>
                      {warehouseAddressSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectWarehouseSuggestion(item)}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[var(--mist)] flex items-start gap-2 transition-colors cursor-pointer group"
                        >
                          <div className="mt-0.5 text-[#1090F8] shrink-0">
                            <IconPin className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[var(--ink)] truncate group-hover:text-[#1090F8]">
                              {item.display_name.split(',')[0]}
                            </p>
                            <p className="text-[10px] text-[#24252c]/60 truncate">
                              {item.display_name.split(',').slice(1).join(', ').trim()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Leaflet Map Area */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#24252c]/70 flex items-center gap-1.5">
                  <IconPin className="w-3.5 h-3.5 text-[#1090F8]" />
                  Drag marker or click map to set Warehouse Pin:
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Green Radius = {tempLogistics.freeRadiusKm} km Free Transport Zone
                </span>
              </div>

              <div
                ref={warehouseMapContainer}
                className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-[#24252c]/15 shadow-inner relative z-0"
              />
            </div>

            {/* Coordinates and Save Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#24252c]/[0.06]">
              <div className="text-[11px] text-[#24252c]/60 flex items-center gap-3">
                <span>Lat: <strong className="font-mono text-[var(--ink)]">{tempLogistics.warehouseLat}</strong></span>
                <span>Lng: <strong className="font-mono text-[var(--ink)]">{tempLogistics.warehouseLng}</strong></span>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLogistics}
                  disabled={savingLogistics}
                  className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5"
                >
                  {savingLogistics ? 'Saving...' : 'Save Warehouse Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
