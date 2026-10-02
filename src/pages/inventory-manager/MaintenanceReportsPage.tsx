import { useState, useEffect, useMemo, useRef } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconBox,
  IconTicket,
  IconShield,
  IconSearch,
  IconCheck,
  IconPrinter,
  IconDownload,
  IconFileSpreadsheet,
  IconChevronDown,
  IconX,
} from '../../components/shared/icons';
import {
  fetchMaintenanceReportData,
  exportMaintenanceToCSV,
  exportMaintenanceToExcel,
  computeMaintenanceSummary,
  type MaintenanceLogEntry,
  type MaintenanceStatsSummary,
} from '../../utils/maintenanceReportService';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { DualCalendarDateRangePicker, formatDateWords, formatRangeWords } from '../../components/shared/DualCalendarDateRangePicker';
import binhiLogo from '../../assets/branding/BINHI Concept Logo.webp';

export default function MaintenanceReportsPage({ go }: { go: (p: Page) => void }) {
  const [logs, setLogs] = useState<MaintenanceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'In Repair' | 'Restored' | 'Decommissioned'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [liabilityFilter, setLiabilityFilter] = useState<string>('All');

  // Date Filters
  const [datePreset, setDatePreset] = useState<'all' | 'this_month' | '30days' | 'year' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Print Preview Modal & Export Menu
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedEntryDetail, setSelectedEntryDetail] = useState<MaintenanceLogEntry | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchMaintenanceReportData();
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load maintenance reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('inventory-updated', loadData);
    return () => window.removeEventListener('inventory-updated', loadData);
  }, []);

  const handlePresetChange = (preset: 'all' | 'this_month' | '30days' | 'year' | 'custom') => {
    setDatePreset(preset);
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
    }
  };

  // Filtered List
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      // Date filter
      if (startDate && l.quarantineDate < startDate) return false;
      if (endDate && l.quarantineDate > endDate) return false;

      const matchSearch =
        !search ||
        l.serialId.toLowerCase().includes(search.toLowerCase()) ||
        l.modelName.toLowerCase().includes(search.toLowerCase()) ||
        l.issueDescription.toLowerCase().includes(search.toLowerCase()) ||
        (l.technicianNotes && l.technicianNotes.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === 'All' || l.status === statusFilter;
      const matchCategory = categoryFilter === 'All' || l.category === categoryFilter;
      const matchSeverity = severityFilter === 'All' || l.severity === severityFilter;
      const matchLiability = liabilityFilter === 'All' || l.clientLiability === liabilityFilter;

      return matchSearch && matchStatus && matchCategory && matchSeverity && matchLiability;
    });
  }, [logs, search, statusFilter, categoryFilter, severityFilter, liabilityFilter, startDate, endDate]);

  // Dynamically computed summary based on filtered date range and criteria
  const summary = useMemo(() => {
    return computeMaintenanceSummary(filteredLogs);
  }, [filteredLogs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.category) set.add(l.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [logs]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Screen Header & Top Navigation Bar ── */}
      <div className="space-y-4 pb-4 border-b border-[#24252c]/[0.08]">
        {/* Top Report Type Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-[var(--mist)] rounded-2xl border border-[#24252c]/[0.08] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => go('inventory-reports')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] hover:bg-white/60 transition-all cursor-pointer"
            >
              <IconTicket className="w-3.5 h-3.5 text-[#1090F8]" />
              <span>Equipment Usage & Wear</span>
            </button>
            <button
              type="button"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-[var(--ink)] shadow-xs transition-all cursor-default"
            >
              <IconShield className="w-3.5 h-3.5 text-amber-600" />
              <span>Maintenance & Quarantine</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <MonoBadge icon={IconShield}>Inventory Intelligence</MonoBadge>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Audit & Compliance
            </span>
          </div>
        </div>

        {/* Title & Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              Equipment Maintenance & Quarantine Reports
            </h1>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Official audit tracking for equipment downtime, repair costs, failure frequency, and liability attribution.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Refresh */}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 bg-white border border-[#24252c]/15 text-[var(--ink)] text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[var(--mist)] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh maintenance data"
            >
              <span className={`inline-block ${loading ? 'animate-spin text-[#1090F8]' : ''}`}>↻</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Consolidated Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 bg-white border border-[#24252c]/15 text-[var(--ink)] text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[var(--mist)] transition-colors shadow-2xs cursor-pointer"
                title="Export maintenance report"
              >
                <IconDownload className="w-3.5 h-3.5 text-[#1090F8]" />
                <span>Export</span>
                <IconChevronDown className={`w-3.5 h-3.5 text-[#24252c]/50 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white border border-[#24252c]/10 shadow-xl p-1.5 z-30 space-y-1 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 border-b border-[#24252c]/[0.06]">
                    Export Maintenance Data
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportMaintenanceToExcel(filteredLogs, summary, `${datePreset} Range`);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] transition-colors text-left cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#1090F8] flex items-center justify-center shrink-0">
                      <IconDownload className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Export Excel (.xlsx)</div>
                      <div className="text-[10px] text-[#24252c]/50">Summary & incident logs workbook</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportMaintenanceToCSV(filteredLogs);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] transition-colors text-left cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <IconFileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Export CSV (.csv)</div>
                      <div className="text-[10px] text-[#24252c]/50">Downtime & repairs matrix</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Formal Print Preview */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[var(--ink-soft)] transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <IconPrinter className="w-3.5 h-3.5" />
              <span>Formal Print Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active In Repair</span>
              <IconBox className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-2">
              {summary.totalUnderRepair} <span className="text-xs font-semibold text-amber-700">units</span>
            </div>
            <div className="text-[10px] text-amber-800/80 mt-1 font-medium">
              Safely locked from catalog & booking pool
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-bold uppercase tracking-wider">Restored to Fleet</span>
              <IconCheck className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-2">
              {summary.totalRestored} <span className="text-xs font-semibold text-emerald-700">units</span>
            </div>
            <div className="text-[10px] text-emerald-800/80 mt-1 font-medium">
              Repaired & returned to warehouse stock
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between text-[#24252c]/50">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Downtime (MTTR)</span>
              <span className="text-xs font-bold text-[#1090F8]">Mean Time</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)] mt-2">
              {summary.avgDowntimeDays} <span className="text-xs font-semibold text-[#24252c]/50">days</span>
            </div>
            <div className="text-[10px] text-[#24252c]/60 mt-1 font-medium">
              Turnaround from quarantine to restoration
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between text-[#24252c]/50">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Repair Impact</span>
              <span className="text-xs font-bold text-rose-600">Cost Valuation</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#1090F8] mt-2">
              ₱{summary.totalEstimatedCost.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#24252c]/60 mt-1 flex justify-between font-medium">
              <span>Client: ₱{summary.totalClientLiableAmount.toLocaleString()}</span>
              <span>Co: ₱{summary.totalCompanyAbsorbedAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── High-Failure Ranking & Category Distribution ── */}
      {summary && summary.highFailureModels.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-[var(--ink)]">High-Wear & Frequent Failure Equipment</h3>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                Maintenance Priority
              </span>
            </div>
            <p className="text-[11px] text-[#24252c]/60 mb-3">
              Models with the highest rate of repair incidents. Recommended for preventative servicing.
            </p>
            <div className="space-y-2">
              {summary.highFailureModels.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.04] text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-white text-[var(--ink)] font-extrabold text-[10px] flex items-center justify-center border border-[#24252c]/10">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-[var(--ink)] truncate">{m.modelName}</div>
                      <div className="text-[10px] text-[#24252c]/50">{m.category}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-extrabold text-rose-600 block">{m.failureCount} incidents</span>
                    <span className="text-[10px] text-[#24252c]/50">₱{m.totalCost.toLocaleString()} est</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-[var(--ink)]">Category Cost Distribution</h3>
              <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-full">
                Expense Spread
              </span>
            </div>
            <p className="text-[11px] text-[#24252c]/60 mb-3">
              Breakdown of total repair expenses and incident volume categorized by gear discipline.
            </p>
            <div className="space-y-2">
              {summary.categoryBreakdown.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.04] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[var(--ink)]">{cat.category}</span>
                    <span className="text-[10px] text-[#24252c]/50 block">{cat.count} total log records</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[var(--ink)]">₱{cat.cost.toLocaleString()}</span>
                    <span className="text-[10px] text-[#24252c]/50 block">Cumulative repair</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters & Search Bar ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial ID, equipment name, defect or notes..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#24252c]/10 bg-[var(--mist)] text-xs text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8]"
            />
            <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Quick Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['All', 'In Repair', 'Restored', 'Decommissioned'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[var(--ink)] text-white'
                    : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters & Dual Calendar Date Range Picker */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#24252c]/[0.06] text-xs">
          {/* Category */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#24252c]/50 font-medium whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8] shadow-2xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#24252c]/50 font-medium whitespace-nowrap">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8] shadow-2xs"
            >
              <option value="All">All Severities</option>
              <option value="High">High Severity</option>
              <option value="Medium">Medium Severity</option>
              <option value="Low">Low Severity</option>
            </select>
          </div>

          {/* Liability Attribution */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#24252c]/50 font-medium whitespace-nowrap">Liability:</span>
            <select
              value={liabilityFilter}
              onChange={(e) => setLiabilityFilter(e.target.value)}
              className="rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8] shadow-2xs"
            >
              <option value="All">All Liabilities</option>
              <option value="Client Liable">Client Liable</option>
              <option value="Company Absorbed">Company Absorbed</option>
              <option value="Under Investigation">Under Investigation</option>
            </select>
          </div>

          {/* Custom Dual-Calendar Date Range Picker with Presets & Strict Range Validation */}
          <DualCalendarDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            preset={datePreset}
            onPresetChange={(p) => setDatePreset(p as any)}
          />

          {/* Reset Filters (if active) */}
          {(startDate || endDate || statusFilter !== 'All' || categoryFilter !== 'All' || severityFilter !== 'All' || liabilityFilter !== 'All' || search || datePreset !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setStatusFilter('All');
                setCategoryFilter('All');
                setSeverityFilter('All');
                setLiabilityFilter('All');
                setSearch('');
                setDatePreset('all');
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <IconX className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Data Ledger Table ── */}
      <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#24252c]/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--ink)]">Maintenance & Quarantine Ledger</h3>
            <p className="text-[11px] text-[#24252c]/50">
              Showing {filteredLogs.length} of {logs.length} logged maintenance records
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#24252c]/50 space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-[#1090F8] border-t-transparent animate-spin mx-auto" />
            <p>Loading fleet maintenance records from database...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#24252c]/50">
            No maintenance records match your filter criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--mist)] text-[#24252c]/60 font-semibold border-b border-[#24252c]/[0.06]">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Serial Tag & Model</th>
                    <th className="py-3 px-3 whitespace-nowrap">Defect / Reason</th>
                    <th className="py-3 px-3 whitespace-nowrap">Quarantine Date</th>
                    <th className="py-3 px-3 whitespace-nowrap">Downtime</th>
                    <th className="py-3 px-3 whitespace-nowrap">Est. Cost & Liability</th>
                    <th className="py-3 px-3 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-black/[0.015] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[11px] text-[var(--ink)] flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {l.serialId}
                          </span>
                        </div>
                        <div className="font-semibold text-[var(--ink)] mt-1">{l.modelName}</div>
                        <div className="text-[10px] text-[#24252c]/50">{l.category} · {l.brand}</div>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-[var(--ink)] leading-snug line-clamp-2">
                          {l.issueDescription}
                        </div>
                        {l.eventName && (
                          <div className="text-[10px] text-[#1090F8] font-semibold mt-0.5 truncate">
                            Event: {l.eventName}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-[var(--ink)]">{formatDateWords(l.quarantineDate) || l.quarantineDate}</div>
                        <div className="text-[10px] text-[#24252c]/50">
                          {l.restoredDate ? `Restored: ${formatDateWords(l.restoredDate)}` : 'Currently Active'}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-extrabold text-[var(--ink)]">{l.downtimeDays}</span>
                        <span className="text-[10px] text-[#24252c]/50 ml-1">days</span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-[var(--ink)]">₱{l.estimatedCost.toLocaleString()}</div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            l.clientLiability === 'Client Liable'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {l.clientLiability}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            l.status === 'In Repair'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : l.status === 'Restored'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-800 text-white'
                          }`}
                        >
                          {l.status === 'In Repair' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                          {l.status === 'Restored' && <IconCheck className="w-3 h-3 text-emerald-600" />}
                          {l.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryDetail(l)}
                          className="text-[11px] font-semibold text-[#1090F8] hover:underline cursor-pointer"
                        >
                          View Audit Log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Zero Horizontal Scrollbar) */}
            <div className="block lg:hidden p-4 space-y-3">
              {filteredLogs.map((l) => (
                <div
                  key={l.id}
                  className="p-4 rounded-2xl bg-[var(--mist)]/40 border border-[#24252c]/[0.08] space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 inline-block mb-1">
                        {l.serialId}
                      </span>
                      <div className="font-bold text-sm text-[var(--ink)]">{l.modelName}</div>
                      <div className="text-[10px] text-[#24252c]/50">{l.category} · {l.brand}</div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${
                        l.status === 'In Repair'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : l.status === 'Restored'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-zinc-800 text-white'
                      }`}
                    >
                      {l.status === 'In Repair' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      {l.status === 'Restored' && <IconCheck className="w-3 h-3 text-emerald-600" />}
                      {l.status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-[#24252c]/[0.06] text-xs">
                    <p className="font-medium text-[var(--ink)]">{l.issueDescription}</p>
                    {l.eventName && (
                      <p className="text-[10px] text-[#1090F8] font-semibold mt-1">Event: {l.eventName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-[#24252c]/50 block text-[10px] uppercase font-bold">Quarantine Date</span>
                      <strong className="text-[var(--ink)]">{formatDateWords(l.quarantineDate) || l.quarantineDate}</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50 block text-[10px] uppercase font-bold">Downtime</span>
                      <strong className="text-[var(--ink)]">{l.downtimeDays} Days</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50 block text-[10px] uppercase font-bold">Estimated Cost</span>
                      <strong className="text-[var(--ink)]">₱{l.estimatedCost.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-[#24252c]/50 block text-[10px] uppercase font-bold">Liability</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                          l.clientLiability === 'Client Liable'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {l.clientLiability}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEntryDetail(l)}
                    className="w-full bg-white border border-[#24252c]/15 hover:border-[#1090F8] text-[var(--ink)] text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center mt-1"
                  >
                    View Complete Audit Log →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Inspection Modal ── */}
      {selectedEntryDetail && (
        <ModalOverlay isOpen={Boolean(selectedEntryDetail)} onClose={() => setSelectedEntryDetail(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/[0.08]">
              <div>
                <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                  {selectedEntryDetail.serialId}
                </span>
                <h3 className="text-lg font-extrabold text-[var(--ink)] mt-1">{selectedEntryDetail.modelName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntryDetail(null)}
                className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[var(--mist)] p-3 rounded-xl border border-[#24252c]/[0.06]">
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Status</span>
                  <span className="font-bold text-[var(--ink)]">{selectedEntryDetail.status}</span>
                </div>
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Quarantine Date</span>
                  <span className="font-bold text-[var(--ink)]">{formatDateWords(selectedEntryDetail.quarantineDate)}</span>
                </div>
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Downtime</span>
                  <span className="font-bold text-[var(--ink)]">{selectedEntryDetail.downtimeDays} Days</span>
                </div>
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Restoration</span>
                  <span className="font-bold text-[var(--ink)]">
                    {selectedEntryDetail.restoredDate ? formatDateWords(selectedEntryDetail.restoredDate) : 'Ongoing'}
                  </span>
                </div>
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Estimated Cost</span>
                  <span className="font-bold text-[#1090F8]">₱{selectedEntryDetail.estimatedCost.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block">Liability</span>
                  <span className="font-bold text-[var(--ink)]">{selectedEntryDetail.clientLiability}</span>
                </div>
              </div>

              <div>
                <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block mb-0.5">Defect Description</span>
                <p className="p-3 bg-white border border-[#24252c]/10 rounded-xl font-medium text-[var(--ink)]">
                  {selectedEntryDetail.issueDescription}
                </p>
              </div>

              {selectedEntryDetail.technicianNotes && (
                <div>
                  <span className="text-[#24252c]/50 text-[10px] uppercase font-bold block mb-0.5">Technician Resolution Notes</span>
                  <p className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl font-medium text-amber-950">
                    {selectedEntryDetail.technicianNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEntryDetail(null)}
                className="bg-[var(--ink)] text-white text-xs font-semibold py-2.5 px-5 rounded-full cursor-pointer hover:bg-[var(--ink-soft)] transition-colors"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── FORMAL PRINTABLE AUDIT SHEET MODAL (Executive Letterhead Layout) ── */}
      <ModalOverlay isOpen={showPrintModal} onClose={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#24252c]/10">
          <div className="flex items-center justify-between pb-4 border-b border-[#24252c]/[0.08]">
            <div className="flex items-center gap-2">
              <IconPrinter className="w-5 h-5 text-[#1090F8]" />
              <h3 className="text-base font-extrabold text-[var(--ink)]">Formal Printable Audit Report Preview</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-[#1090F8] text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 hover:bg-[#0c78d0] transition-colors cursor-pointer shadow-sm"
              >
                <IconPrinter className="w-3.5 h-3.5" /> Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="overflow-y-auto flex-1 mt-4 p-6 sm:p-8 border border-zinc-200 rounded-2xl bg-white text-black font-sans print:border-none print:p-0" ref={printAreaRef}>
            {/* Formal Company Header */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-black">
              <div>
                <div className="flex items-center gap-3">
                  <img src={binhiLogo} alt="BINHI Concept" className="h-12 w-auto object-contain" />
                </div>
              </div>

              <div className="text-right text-[11px]">
                <span className="text-[10px] font-mono font-bold bg-zinc-100 border border-zinc-300 px-2 py-1 rounded">
                  DOC REF: BINHI-MAINT-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}
                </span>
                <p className="mt-2 text-zinc-600 font-medium">Date Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-zinc-600 font-medium">
                  Reporting Period: {formatRangeWords(startDate, endDate)}
                </p>
                <p className="text-zinc-600 font-medium">Scope: Full Warehouse Fleet Audit</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="my-6 text-center">
              <h2 className="text-lg font-black tracking-tight uppercase">
                EQUIPMENT FLEET MAINTENANCE & QUARANTINE AUDIT REPORT
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                Official Incident Log, Downtime Metrics & Hardware Financial Impact Summary
              </p>
            </div>

            {/* Executive Metrics Table */}
            {summary && (
              <div className="grid grid-cols-4 gap-2 mb-6 text-center text-xs">
                <div className="p-3 border border-zinc-300 rounded-lg bg-zinc-50">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Quarantined</span>
                  <span className="text-base font-black">{summary.totalUnderRepair} units</span>
                </div>
                <div className="p-3 border border-zinc-300 rounded-lg bg-zinc-50">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Restored</span>
                  <span className="text-base font-black">{summary.totalRestored} units</span>
                </div>
                <div className="p-3 border border-zinc-300 rounded-lg bg-zinc-50">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Avg MTTR Downtime</span>
                  <span className="text-base font-black">{summary.avgDowntimeDays} Days</span>
                </div>
                <div className="p-3 border border-zinc-300 rounded-lg bg-zinc-50">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Repair Val.</span>
                  <span className="text-base font-black">₱{summary.totalEstimatedCost.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Formal Detailed Ledger Table */}
            <table className="w-full text-left text-[11px] border-collapse border border-zinc-300 mb-8">
              <thead>
                <tr className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-300">
                  <th className="p-2 border-r border-zinc-300">Serial Tag</th>
                  <th className="p-2 border-r border-zinc-300">Model Name & Category</th>
                  <th className="p-2 border-r border-zinc-300">Defect Description</th>
                  <th className="p-2 border-r border-zinc-300">Quarantined</th>
                  <th className="p-2 border-r border-zinc-300 text-center">Downtime</th>
                  <th className="p-2 border-r border-zinc-300 text-right">Repair Cost</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredLogs.map((l, i) => (
                  <tr key={i} className="even:bg-zinc-50/50">
                    <td className="p-2 font-mono font-bold border-r border-zinc-200">{l.serialId}</td>
                    <td className="p-2 border-r border-zinc-200">
                      <div className="font-bold">{l.modelName}</div>
                      <div className="text-[10px] text-zinc-500">{l.category}</div>
                    </td>
                    <td className="p-2 border-r border-zinc-200 text-zinc-700">{l.issueDescription}</td>
                    <td className="p-2 border-r border-zinc-200 whitespace-nowrap">{l.quarantineDate}</td>
                    <td className="p-2 border-r border-zinc-200 text-center font-bold">{l.downtimeDays}d</td>
                    <td className="p-2 border-r border-zinc-200 text-right font-bold">₱{l.estimatedCost.toLocaleString()}</td>
                    <td className="p-2 font-bold whitespace-nowrap">
                      {l.status === 'In Repair' ? 'UNDER REPAIR' : l.status.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
        </div>
      </ModalOverlay>
    </div>
  );
}
