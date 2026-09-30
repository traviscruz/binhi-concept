import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconTicket,
  IconX,
  IconDownload,
  IconFileSpreadsheet,
  IconSearch,
  IconShield,
  IconInfo,
  IconCheck,
  IconPrinter,
  IconPin,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import {
  fetchEquipmentUsageStats,
  exportEquipmentUsageToExcel,
  exportEquipmentUsageToCSV,
  type EquipmentModelUsage,
  type UsageFleetSummary,
  type BookingUsageEvent,
  type TimeRangeFilter,
  type EventScopeFilter,
} from '../../utils/equipmentUsageService';
import binhiLogo from '../../assets/branding/BINHI Concept Logo.webp';

export default function UsageReportsPage({ go }: { go: (p: Page) => void }) {
  const [loading, setLoading] = useState(true);
  const [modelsUsage, setModelsUsage] = useState<EquipmentModelUsage[]>([]);
  const [summary, setSummary] = useState<UsageFleetSummary | null>(null);
  const [allEvents, setAllEvents] = useState<BookingUsageEvent[]>([]);

  // Filter States
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [scope, setScope] = useState<EventScopeFilter>('completed_only');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedModelForAudit, setSelectedModelForAudit] = useState<EquipmentModelUsage | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Load Real Equipment Usage from Supabase
  const loadUsageData = async () => {
    setLoading(true);
    try {
      const data = await fetchEquipmentUsageStats({ timeRange, scope, startDate, endDate });
      setModelsUsage(data.modelsUsage);
      setSummary(data.summary);
      setAllEvents(data.allEvents);
    } catch (err) {
      console.error('Failed to load usage reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsageData();
  }, [timeRange, scope, startDate, endDate]);

  const handlePresetChange = (preset: TimeRangeFilter) => {
    setTimeRange(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past30.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'year') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      setStartDate(firstDayYear.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'quarter') {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      setStartDate(quarterStart.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    modelsUsage.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [modelsUsage]);

  // Filtered Equipment Models
  const filteredModels = useMemo(() => {
    return modelsUsage.filter((m) => {
      const matchesCat = selectedCategory === 'All' || m.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.modelId.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.brand.toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });
  }, [modelsUsage, selectedCategory, searchQuery]);

  // Time Range display string
  const timeRangeLabel = useMemo(() => {
    if (startDate || endDate) {
      return `${startDate || 'Earliest'} to ${endDate || 'Latest'}`;
    }
    switch (timeRange) {
      case '30days':
        return 'Last 30 Days';
      case 'this_month':
        return 'This Current Month';
      case 'quarter':
        return 'This Quarter (Q3/Q4)';
      case 'year':
        return 'This Calendar Year';
      case 'custom':
        return 'Custom Date Range';
      default:
        return 'All Time History';
    }
  }, [timeRange, startDate, endDate]);

  const handleExportExcel = () => {
    if (!summary) return;
    exportEquipmentUsageToExcel(filteredModels, summary, `${timeRangeLabel} (Completed Events Only)`);
    setExportSuccessMessage('Excel usage report workbook with granular event logs downloaded.');
    setTimeout(() => setExportSuccessMessage(null), 4000);
  };

  const handleExportCSV = () => {
    exportEquipmentUsageToCSV(filteredModels);
    setExportSuccessMessage('Equipment utilization CSV spreadsheet downloaded.');
    setTimeout(() => setExportSuccessMessage(null), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <MonoBadge icon={IconTicket}>Warehouse Operations</MonoBadge>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Completed Events Only
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Equipment Usage & Wear Reports
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Actual accumulated operational hours and wear index computed strictly from completed bookings.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => go('inventory-maintenance-reports')}
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold px-3.5 py-2 rounded-full hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
          >
            <IconShield className="w-3.5 h-3.5 text-amber-700" />
            <span>Maintenance & Quarantine Reports</span>
          </button>

          <button
            onClick={() => loadUsageData()}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white border border-[#24252c]/10 text-[var(--ink)] text-xs font-semibold px-3.5 py-2 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh query from Supabase"
          >
            <span className={`inline-block ${loading ? 'animate-spin' : ''}`}>↻</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-white border border-[#24252c]/10 text-[var(--ink)] text-xs font-semibold px-3.5 py-2 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm cursor-pointer"
          >
            <IconFileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-white border border-[#24252c]/10 text-[var(--ink)] text-xs font-semibold px-3.5 py-2 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm cursor-pointer"
          >
            <IconDownload className="w-3.5 h-3.5 text-[#1090F8]" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm cursor-pointer"
          >
            <span>Print / PDF Report</span>
          </button>
        </div>
      </div>

      {/* Export Notification Toast */}
      {exportSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <IconCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{exportSuccessMessage}</span>
          </div>
          <button onClick={() => setExportSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── KPI Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Operational Hours */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#24252c]/50">Total Operational Runtime</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#1090F8]">
              <IconTicket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
              {loading ? '...' : `${summary?.totalFleetOperatingHours ?? 0} hrs`}
            </div>
            <p className="text-[11px] font-medium text-[#1090F8] mt-0.5">
              Accumulated across {summary?.totalCompletedEvents ?? 0} {scope === 'completed_only' ? 'completed' : 'active'} events
            </p>
          </div>
        </div>

        {/* Completed Events Tracked */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#24252c]/50">Events In Scope</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IconCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
              {loading ? '...' : `${summary?.totalCompletedEvents ?? 0} Events`}
            </div>
            <p className="text-[11px] font-medium text-emerald-600 mt-0.5">
              {summary?.totalEquipmentDeployments ?? 0} total gear unit deployments
            </p>
          </div>
        </div>

        {/* Fleet Average Utilization */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#24252c]/50">Average Fleet Utilization</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <span className="text-xs font-mono font-bold">%</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
              {loading ? '...' : `${summary?.avgFleetUtilization ?? 0}%`}
            </div>
            <p className="text-[11px] font-medium text-purple-600 mt-0.5">
              Target operating capacity metric
            </p>
          </div>
        </div>

        {/* Most Utilized Gear */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#24252c]/50">Top Utilized Model</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <IconShield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-extrabold text-[var(--ink)] truncate" title={summary?.topUtilizedModel}>
              {loading ? '...' : summary?.topUtilizedModel || 'N/A'}
            </div>
            <p className="text-[11px] font-medium text-amber-600 mt-0.5">
              Category: {summary?.topCategory ?? 'All'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ── */}
      <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search equipment model or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-transparent bg-[#EEEEEE] pl-9 pr-4 py-2 text-xs text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors"
            />
          </div>

          {/* Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#24252c]/50 font-medium">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-[#24252c]/15 bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Preset */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#24252c]/50 font-medium">Period:</span>
              <select
                value={timeRange}
                onChange={(e) => handlePresetChange(e.target.value as TimeRangeFilter)}
                className="rounded-lg border border-[#24252c]/15 bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8]"
              >
                <option value="all">All Time</option>
                <option value="30days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Event Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#24252c]/50 font-medium">Status:</span>
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-50/80 px-2.5 py-1 text-xs text-emerald-700 font-bold flex items-center gap-1">
                <IconCheck className="w-3 h-3 text-emerald-600" />
                <span>Completed Events Only</span>
              </span>
            </div>
          </div>
        </div>

        {/* Date Filter Range Pickers */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#24252c]/[0.06] text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 shrink-0">
            Date Filter:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-[var(--mist)] px-2.5 py-1 rounded-lg border border-[#24252c]/10">
              <span className="text-[10px] font-medium text-[#24252c]/50">Start:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setTimeRange('custom');
                }}
                className="bg-transparent text-xs text-[var(--ink)] font-semibold focus:outline-none"
              />
            </div>
            <span className="text-[#24252c]/40 font-medium">–</span>
            <div className="flex items-center gap-1 bg-[var(--mist)] px-2.5 py-1 rounded-lg border border-[#24252c]/10">
              <span className="text-[10px] font-medium text-[#24252c]/50">End:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setTimeRange('custom');
                }}
                className="bg-transparent text-xs text-[var(--ink)] font-semibold focus:outline-none"
              />
            </div>
            {(startDate || endDate || timeRange !== 'all') && (
              <button
                type="button"
                onClick={() => handlePresetChange('all')}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
              >
                <IconX className="w-3 h-3" /> Reset Dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Demand Highlights Cards ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modelsUsage.slice(0, 4).map((item) => {
          let badgeColor = 'bg-blue-50 text-[#1090F8] border-blue-200';
          let progressGrad = 'from-[var(--ink)] to-[#1090F8]';
          if (item.status === 'Highest Demand') {
            badgeColor = 'bg-rose-50 text-rose-600 border-rose-200';
            progressGrad = 'from-rose-500 to-amber-500';
          } else if (item.status === 'Consistent Usage') {
            badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
            progressGrad = 'from-emerald-500 to-teal-500';
          } else if (item.status === 'Moderate Usage') {
            badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
            progressGrad = 'from-amber-500 to-yellow-500';
          }

          return (
            <div
              key={item.modelId}
              onClick={() => setSelectedModelForAudit(item)}
              className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3.5 hover:border-[#1090F8]/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                  {item.status}
                </span>
                <span className="text-xl font-extrabold text-[var(--ink)]">
                  {item.utilizationRate}%
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-[var(--ink)] line-clamp-1 group-hover:text-[#1090F8] transition-colors">
                  {item.name}
                </h3>
                <p className="text-[11px] text-[#24252c]/50 mt-0.5">
                  Accumulated: <strong className="text-[var(--ink)] font-semibold">{item.accumulatedHours} Hours</strong> ({item.eventsCount} events)
                </p>
              </div>

              {/* Utilization Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#24252c]/50">
                  <span>Fleet Utilization</span>
                  <span>{item.accumulatedHours} hrs deployed</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--mist)] overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${progressGrad} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(4, Math.min(100, item.utilizationRate))}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#24252c]/[0.04] flex items-center justify-between text-[11px] text-[#24252c]/60">
                <span>Fleet: {item.totalUnits} Units</span>
                <span className="text-[#1090F8] font-semibold group-hover:underline">View Audit Log →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Comprehensive Equipment Operational Hours & Wear Matrix ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-[var(--ink)]">
              Equipment Models Operational Hours & Wear Matrix
            </h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Calculated from actual event durations ({timeRangeLabel} · {scope === 'completed_only' ? 'Completed Events' : 'All Deployed Events'})
            </p>
          </div>

          <span className="text-xs font-semibold text-[#24252c]/50">
            Showing {filteredModels.length} Equipment Models
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#24252c]/50 flex flex-col items-center gap-2">
            <span className="inline-block animate-spin text-xl text-[#1090F8]">↻</span>
            <p>Querying Supabase bookings & computing operational runtimes...</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#24252c]/50">
            No equipment models match your filter criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Equipment Model & Category</th>
                    <th className="py-3 px-3 text-center">Fleet Size</th>
                    <th className="py-3 px-3">Accumulated Runtime</th>
                    <th className="py-3 px-3 text-center">Deployments</th>
                    <th className="py-3 px-3">Utilization Rate</th>
                    <th className="py-3 px-3">Maintenance & Wear</th>
                    <th className="py-3 px-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredModels.map((item) => {
                    let wearBadge = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                    if (item.wearStatus === 'Inspection Required') {
                      wearBadge = 'bg-rose-50 text-rose-600 border-rose-200';
                    } else if (item.wearStatus === 'Service Due Soon') {
                      wearBadge = 'bg-amber-50 text-amber-600 border-amber-200';
                    } else if (item.wearStatus === 'Moderate Wear') {
                      wearBadge = 'bg-blue-50 text-blue-600 border-blue-200';
                    }

                    return (
                      <tr key={item.modelId} className="hover:bg-[var(--mist)]/60 transition-colors">
                        {/* Model & Category */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[var(--ink)] text-sm">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-[#1090F8] font-bold">ID: {item.modelId}</span>
                            <span className="text-[#24252c]/30">•</span>
                            <span className="text-[11px] text-[#24252c]/60">{item.category}</span>
                            <span className="text-[#24252c]/30">•</span>
                            <span className="text-[10px] text-[#24252c]/40">{item.brand}</span>
                          </div>
                        </td>

                        {/* Fleet Units */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#EEEEEE] text-[var(--ink)]">
                            {item.totalUnits} Units
                          </span>
                        </td>

                        {/* Accumulated Operational Hours */}
                        <td className="py-3.5 px-3">
                          <div className="font-mono font-extrabold text-sm text-[var(--ink)]">
                            {item.accumulatedHours} Hours
                          </div>
                          <div className="text-[11px] text-[#24252c]/50">
                            Avg {item.avgHoursPerEvent} hrs / event
                          </div>
                        </td>

                        {/* Deployments Count */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="font-semibold text-xs text-[var(--ink)]">
                            {item.eventsCount} Events
                          </div>
                          <div className="text-[10px] text-[#24252c]/50">
                            ({item.unitsDeployedCount} total units)
                          </div>
                        </td>

                        {/* Utilization Bar */}
                        <td className="py-3.5 px-3 w-48">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[var(--ink)]">
                              {item.utilizationRate}%
                            </span>
                            <span className="text-[10px] font-semibold text-[#1090F8]">
                              {item.status}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--mist)] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-full"
                              style={{ width: `${Math.max(4, Math.min(100, item.utilizationRate))}%` }}
                            />
                          </div>
                        </td>

                        {/* Wear Health */}
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${wearBadge}`}>
                            {item.wearStatus}
                          </span>
                          <div className="text-[10px] text-[#24252c]/50 mt-1">
                            Next service in: <strong className="text-[var(--ink)] font-mono">{item.nextServiceHoursRemaining}h</strong>
                          </div>
                        </td>

                        {/* Audit Action */}
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedModelForAudit(item)}
                            className="bg-white border border-[#24252c]/15 hover:border-[#1090F8] hover:text-[#1090F8] text-[var(--ink)] text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer shadow-xs"
                          >
                            Audit Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="block lg:hidden space-y-3">
              {filteredModels.map((item) => (
                <div
                  key={item.modelId}
                  className="p-4 rounded-xl bg-[var(--mist)]/50 border border-[#24252c]/[0.08] space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[10px] font-bold text-[#1090F8]">{item.modelId}</div>
                      <div className="font-bold text-sm text-[var(--ink)]">{item.name}</div>
                      <div className="text-[11px] text-[#24252c]/60">{item.category} · {item.brand}</div>
                    </div>
                    <span className="font-mono font-extrabold text-sm text-[var(--ink)] px-2.5 py-1 bg-white rounded-lg border border-[#24252c]/10">
                      {item.accumulatedHours} hrs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#24252c]/[0.06] text-[11px]">
                    <div>
                      <span className="text-[#24252c]/50">Fleet Size:</span>{' '}
                      <strong className="text-[var(--ink)]">{item.totalUnits} Units</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50">Deployments:</span>{' '}
                      <strong className="text-[var(--ink)]">{item.eventsCount} Events</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50">Utilization:</span>{' '}
                      <strong className="text-[#1090F8]">{item.utilizationRate}% ({item.status})</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50">Wear Health:</span>{' '}
                      <strong className="text-[var(--ink)]">{item.wearStatus}</strong>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="h-1.5 rounded-full bg-white overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-full"
                      style={{ width: `${Math.max(4, Math.min(100, item.utilizationRate))}%` }}
                    />
                  </div>

                  <button
                    onClick={() => setSelectedModelForAudit(item)}
                    className="w-full bg-white border border-[#24252c]/15 hover:border-[#1090F8] text-[var(--ink)] text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center"
                  >
                    View Completed Event Logs ({item.eventDeployments.length}) →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Drilldown Event Audit Modal ── */}
      <ModalOverlay isOpen={Boolean(selectedModelForAudit)} onClose={() => setSelectedModelForAudit(null)}>
        {selectedModelForAudit && (
          <div className="bg-white rounded-[2rem] p-6 max-w-2xl w-full shadow-2xl border border-[#24252c]/10 relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedModelForAudit(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#1090F8] px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                  {selectedModelForAudit.modelId}
                </span>
                <span className="text-xs text-[#24252c]/50 font-semibold">{selectedModelForAudit.category}</span>
              </div>
              <h3 className="text-xl font-extrabold text-[var(--ink)] mt-1">
                {selectedModelForAudit.name}
              </h3>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                Audit trail of completed events contributing to accumulated operational runtime.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] text-center">
              <div>
                <div className="text-xs text-[#24252c]/50 font-medium">Accumulated Hours</div>
                <div className="text-lg font-extrabold font-mono text-[var(--ink)] mt-0.5">
                  {selectedModelForAudit.accumulatedHours} hrs
                </div>
              </div>
              <div>
                <div className="text-xs text-[#24252c]/50 font-medium">Total Events</div>
                <div className="text-lg font-extrabold font-mono text-[#1090F8] mt-0.5">
                  {selectedModelForAudit.eventsCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#24252c]/50 font-medium">Next Service</div>
                <div className="text-lg font-extrabold font-mono text-emerald-600 mt-0.5">
                  {selectedModelForAudit.nextServiceHoursRemaining} hrs
                </div>
              </div>
            </div>

            {/* Event Deployments List */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#24252c]/60">
                Completed Deployments Log ({selectedModelForAudit.eventDeployments.length})
              </h4>

              {selectedModelForAudit.eventDeployments.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#24252c]/50 bg-[var(--mist)]/40 rounded-xl border border-dashed border-[#24252c]/15">
                  No completed events logged for this equipment model in the selected time range.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedModelForAudit.eventDeployments.map((dep, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-[#24252c]/[0.08] shadow-2xs space-y-1.5 text-xs hover:border-[#1090F8]/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#1090F8]">{dep.bookingRef}</span>
                        <span className="font-mono font-extrabold text-[var(--ink)]">
                          +{dep.totalModelHours} hrs
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--ink)]">{dep.customerName} · {dep.eventType}</span>
                        <span className="text-[#24252c]/50">{dep.eventDate}</span>
                      </div>

                      <div className="text-[11px] text-[#24252c]/60 truncate flex items-center gap-1">
                        <IconPin className="w-3.5 h-3.5 text-[#24252c]/40 shrink-0" />
                        <span>{dep.venue}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#24252c]/50 pt-1 border-t border-[#24252c]/[0.04]">
                        <span>Event Duration: <strong>{dep.durationHours} hrs</strong> (Qty: {dep.quantity}x)</span>
                        {dep.serialsUsed.length > 0 && (
                          <span className="font-mono">Serials: {dep.serialsUsed.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedModelForAudit(null)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs"
            >
              Done Reviewing Audit
            </button>
          </div>
        )}
      </ModalOverlay>

      {/* ── Printable PDF Report Modal ── */}
      <ModalOverlay isOpen={showPrintModal} onClose={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-4xl w-full shadow-2xl border border-[#24252c]/10 relative space-y-6 max-h-[90vh] overflow-y-auto print:m-0 print:p-0 print:shadow-none print:border-none">
          <div className="flex items-center justify-between pb-4 border-b border-[#24252c]/10 print:hidden">
            <div className="flex items-center gap-2">
              <IconPrinter className="w-5 h-5 text-[#1090F8]" />
              <h3 className="text-base font-extrabold text-[var(--ink)]">Formal Printable Usage Report Preview</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="bg-[#1090F8] text-white text-xs font-bold py-2 px-4 rounded-xl hover:bg-[#0c78d0] transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <IconPrinter className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Formal Letterhead */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-black">
            <div>
              <div className="flex items-center gap-3">
                <img src={binhiLogo} alt="BINHI Concept" className="h-12 w-auto object-contain" />
              </div>
            </div>

            <div className="text-right text-[11px]">
              <span className="text-[10px] font-mono font-bold bg-zinc-100 border border-zinc-300 px-2 py-1 rounded">
                DOC REF: BINHI-USAGE-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}
              </span>
              <p className="mt-2 text-zinc-600 font-medium">Date Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-zinc-600 font-medium">Reporting Period: {timeRangeLabel}</p>
              <p className="text-zinc-600 font-medium">Scope: Fleet Operating Hours & Wear Index</p>
            </div>
          </div>

          <div className="my-2 text-center">
            <h2 className="text-lg font-black tracking-tight uppercase">
              EQUIPMENT FLEET USAGE & OPERATIONAL RUNTIME REPORT
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              Official Accumulated Runtime, Deployment Frequency & Wear Index Ledger
            </p>
          </div>

          {/* Report Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[var(--mist)] text-xs">
            <div>
              <span className="text-[#24252c]/50">Report Range:</span>
              <div className="font-bold text-[var(--ink)]">{timeRangeLabel}</div>
            </div>
            <div>
              <span className="text-[#24252c]/50">Total Runtime:</span>
              <div className="font-bold text-[#1090F8]">{summary?.totalFleetOperatingHours ?? 0} Hours</div>
            </div>
            <div>
              <span className="text-[#24252c]/50">Completed Events:</span>
              <div className="font-bold text-[var(--ink)]">{summary?.totalCompletedEvents ?? 0} Events</div>
            </div>
            <div>
              <span className="text-[#24252c]/50">Generated At:</span>
              <div className="font-bold text-[var(--ink)]">{new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Summary Table for Print */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#24252c]/20 text-[#24252c]/70 font-bold uppercase text-[10px]">
                  <th className="py-2 px-2">Model ID</th>
                  <th className="py-2 px-2">Equipment Name</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2 text-center">Fleet Units</th>
                  <th className="py-2 px-2 text-right">Operating Hours</th>
                  <th className="py-2 px-2 text-right">Events</th>
                  <th className="py-2 px-2 text-right">Utilization</th>
                  <th className="py-2 px-2 text-center">Wear Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24252c]/10">
                {filteredModels.map((m) => (
                  <tr key={m.modelId}>
                    <td className="py-2 px-2 font-mono font-bold text-[#1090F8]">{m.modelId}</td>
                    <td className="py-2 px-2 font-semibold text-[var(--ink)]">{m.name}</td>
                    <td className="py-2 px-2 text-[#24252c]/70">{m.category}</td>
                    <td className="py-2 px-2 text-center">{m.totalUnits}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold">{m.accumulatedHours}h</td>
                    <td className="py-2 px-2 text-right">{m.eventsCount}</td>
                    <td className="py-2 px-2 text-right font-bold">{m.utilizationRate}%</td>
                    <td className="py-2 px-2 text-center font-medium">{m.wearStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formal Verification & Sign-off Block */}
          <div className="pt-8 border-t-2 border-black grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Prepared & Certified By:</p>
              <div className="mt-10 border-b border-black w-48" />
              <p className="font-extrabold text-sm mt-1">Inventory & Warehouse Manager</p>
              <p className="text-[11px] text-zinc-500">BINHI Concept Technical Fleet Department</p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Approved & Noted By:</p>
              <div className="mt-10 border-b border-black w-48" />
              <p className="font-extrabold text-sm mt-1">Chief Production Engineer / Admin</p>
              <p className="text-[11px] text-zinc-500">Executive Management Operations</p>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
