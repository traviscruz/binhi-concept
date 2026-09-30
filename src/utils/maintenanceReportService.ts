import { supabase } from '../lib/supabase';

export interface MaintenanceLogEntry {
  id: string;
  serialId: string;
  modelId: string;
  modelName: string;
  category: string;
  brand: string;
  type: string; // 'Hardware Damage', 'Torn / Broken Cable', 'Lost / Missing Gear', 'Bench Maintenance'
  issueDescription: string;
  quarantineDate: string;
  restoredDate?: string;
  downtimeDays: number;
  status: 'In Repair' | 'Restored' | 'Decommissioned';
  severity: 'High' | 'Medium' | 'Low';
  estimatedCost: number;
  clientLiability: 'Client Liable' | 'Company Absorbed' | 'Under Investigation';
  technicianNotes?: string;
  eventName?: string;
  clientName?: string;
}

export interface MaintenanceStatsSummary {
  totalUnderRepair: number;
  totalRestored: number;
  totalDecommissioned: number;
  totalIncidentsCount: number;
  avgDowntimeDays: number;
  totalEstimatedCost: number;
  totalClientLiableAmount: number;
  totalCompanyAbsorbedAmount: number;
  categoryBreakdown: { category: string; count: number; cost: number }[];
  highFailureModels: { modelName: string; category: string; failureCount: number; totalCost: number }[];
}

export async function fetchMaintenanceReportData(): Promise<{
  logs: MaintenanceLogEntry[];
  summary: MaintenanceStatsSummary;
}> {
  try {
    // 1. Fetch equipment models with physical units
    const { data: modelsData, error: modelsError } = await supabase
      .from('equipment_models')
      .select('*, units:physical_units(*)');

    if (modelsError) console.warn('Error fetching models in maintenance service:', modelsError);

    // 2. Fetch inventory alerts / incident logs
    const { data: alertsData, error: alertsError } = await supabase
      .from('inventory_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (alertsError) console.warn('Error fetching alerts in maintenance service:', alertsError);

    // 3. Fetch audit logs related to quarantine / maintenance
    const { data: auditData } = await supabase
      .from('audit_logs')
      .select('*')
      .or('action.ilike.%quarantine%,action.ilike.%repair%,action.ilike.%maintenance%')
      .order('timestamp', { ascending: false });

    const logs: MaintenanceLogEntry[] = [];
    const modelsLookup = new Map<string, any>();
    (modelsData || []).forEach((m: any) => {
      modelsLookup.set(m.model_id || m.id, m);
    });

    const now = new Date();

    // Collect currently quarantined units from physical_units
    (modelsData || []).forEach((model: any) => {
      (model.units || []).forEach((u: any) => {
        if (u.status === 'Maintenance / Repair' || u.status === 'Decommissioned / Inactive' || u.condition === 'In Repair') {
          const qDate = u.last_maintenance || u.lastMaintenance || u.created_at || '2026-09-15';
          const qTime = new Date(qDate).getTime();
          const downtimeDays = Math.max(1, Math.round((now.getTime() - qTime) / (1000 * 60 * 60 * 24)));

          logs.push({
            id: `unit-${u.serial_id || u.serialId || Math.random()}`,
            serialId: u.serial_id || u.serialId || 'SN-UNKNOWN',
            modelId: model.model_id,
            modelName: model.name,
            category: model.category || 'General Equipment',
            brand: model.brand || 'BINHI Standard',
            type: u.condition === 'In Repair' ? 'Bench Hardware Repair' : 'Quarantine / Maintenance',
            issueDescription: u.notes || 'Tagged for maintenance inspection & diagnostic testing.',
            quarantineDate: qDate.split('T')[0],
            downtimeDays,
            status: u.status === 'Decommissioned / Inactive' ? 'Decommissioned' : 'In Repair',
            severity: 'High',
            estimatedCost: Number(model.rental_rate || 2500) * 1.5,
            clientLiability: 'Company Absorbed',
            technicianNotes: u.notes || 'Awaiting replacement component / bench testing.',
          });
        }
      });
    });

    // Add entries from inventory_alerts (Damage & Post-Event Incidents)
    (alertsData || []).forEach((alert: any) => {
      const model = alert.model_id ? modelsLookup.get(alert.model_id) : null;
      const parsedDetails = alert.details || alert.description || '';
      const isResolved = alert.status === 'Resolved' || Boolean(alert.resolved_at);
      const qDate = alert.date || alert.created_at || '2026-09-18';
      const qTime = new Date(qDate).getTime();
      const rTime = alert.resolved_at ? new Date(alert.resolved_at).getTime() : now.getTime();
      const downtimeDays = Math.max(1, Math.round((rTime - qTime) / (1000 * 60 * 60 * 24)));

      const estCost = Number(alert.estimated_cost ?? alert.estimatedCost ?? 3500);
      const liability = alert.client_liability || alert.clientLiability || 'Company Absorbed';

      logs.push({
        id: alert.id || `alert-${Math.random()}`,
        serialId: alert.serial_id || alert.serialId || (model ? `${model.model_id}-001` : 'INC-ACC-01'),
        modelId: alert.model_id || 'MISC',
        modelName: model?.name || alert.gear || 'Production Hardware',
        category: model?.category || 'Audio Production',
        brand: model?.brand || 'BINHI Standard',
        type: alert.type || 'Hardware Damage',
        issueDescription: parsedDetails || alert.gear || 'Equipment fault recorded post-event.',
        quarantineDate: qDate.split('T')[0],
        restoredDate: alert.resolved_at ? alert.resolved_at.split('T')[0] : undefined,
        downtimeDays,
        status: isResolved ? 'Restored' : 'In Repair',
        severity: alert.severity || 'Medium',
        estimatedCost: estCost,
        clientLiability: liability,
        technicianNotes: alert.resolution_notes || alert.notes || 'Inspected by warehouse maintenance technician.',
        eventName: alert.event_name || alert.eventName,
        clientName: alert.client_name || alert.clientName,
      });
    });

    // Deduplicate by ID
    const uniqueLogsMap = new Map<string, MaintenanceLogEntry>();
    logs.forEach((l) => uniqueLogsMap.set(l.id, l));
    const uniqueLogs = Array.from(uniqueLogsMap.values()).sort(
      (a, b) => new Date(b.quarantineDate).getTime() - new Date(a.quarantineDate).getTime()
    );

    const summary = computeMaintenanceSummary(uniqueLogs);
    return { logs: uniqueLogs, summary };
  } catch (e) {
    console.error('Error fetching maintenance report data:', e);
    return {
      logs: [],
      summary: {
        totalUnderRepair: 0,
        totalRestored: 0,
        totalDecommissioned: 0,
        totalIncidentsCount: 0,
        avgDowntimeDays: 0,
        totalEstimatedCost: 0,
        totalClientLiableAmount: 0,
        totalCompanyAbsorbedAmount: 0,
        categoryBreakdown: [],
        highFailureModels: [],
      },
    };
  }
}

export function computeMaintenanceSummary(uniqueLogs: MaintenanceLogEntry[]): MaintenanceStatsSummary {
  const totalUnderRepair = uniqueLogs.filter((l) => l.status === 'In Repair').length;
  const totalRestored = uniqueLogs.filter((l) => l.status === 'Restored').length;
  const totalDecommissioned = uniqueLogs.filter((l) => l.status === 'Decommissioned').length;
  const totalIncidentsCount = uniqueLogs.length;

  const totalDays = uniqueLogs.reduce((sum, l) => sum + (l.downtimeDays || 0), 0);
  const avgDowntimeDays = totalIncidentsCount > 0 ? Math.round((totalDays / totalIncidentsCount) * 10) / 10 : 0;

  const totalEstimatedCost = uniqueLogs.reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
  const totalClientLiableAmount = uniqueLogs
    .filter((l) => l.clientLiability === 'Client Liable')
    .reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
  const totalCompanyAbsorbedAmount = uniqueLogs
    .filter((l) => l.clientLiability === 'Company Absorbed')
    .reduce((sum, l) => sum + (l.estimatedCost || 0), 0);

  // Category Breakdown
  const catMap = new Map<string, { count: number; cost: number }>();
  uniqueLogs.forEach((l) => {
    const existing = catMap.get(l.category) || { count: 0, cost: 0 };
    catMap.set(l.category, {
      count: existing.count + 1,
      cost: existing.cost + (l.estimatedCost || 0),
    });
  });

  const categoryBreakdown = Array.from(catMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    cost: data.cost,
  }));

  // High Failure Models
  const modelFailMap = new Map<string, { modelName: string; category: string; failureCount: number; totalCost: number }>();
  uniqueLogs.forEach((l) => {
    const existing = modelFailMap.get(l.modelName) || {
      modelName: l.modelName,
      category: l.category,
      failureCount: 0,
      totalCost: 0,
    };
    modelFailMap.set(l.modelName, {
      modelName: l.modelName,
      category: l.category,
      failureCount: existing.failureCount + 1,
      totalCost: existing.totalCost + (l.estimatedCost || 0),
    });
  });

  const highFailureModels = Array.from(modelFailMap.values())
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 5);

  return {
    totalUnderRepair,
    totalRestored,
    totalDecommissioned,
    totalIncidentsCount,
    avgDowntimeDays,
    totalEstimatedCost,
    totalClientLiableAmount,
    totalCompanyAbsorbedAmount,
    categoryBreakdown,
    highFailureModels,
  };
}

export function exportMaintenanceToCSV(logs: MaintenanceLogEntry[]) {
  const headers = [
    'Serial ID',
    'Equipment Model',
    'Category',
    'Brand',
    'Defect Type',
    'Issue Description',
    'Quarantine Date',
    'Restored Date',
    'Downtime (Days)',
    'Status',
    'Severity',
    'Estimated Cost (PHP)',
    'Liability Attribution',
    'Event Name',
    'Technician Notes',
  ];

  const rows = logs.map((l) => [
    `"${l.serialId}"`,
    `"${l.modelName}"`,
    `"${l.category}"`,
    `"${l.brand}"`,
    `"${l.type}"`,
    `"${l.issueDescription.replace(/"/g, '""')}"`,
    `"${l.quarantineDate}"`,
    `"${l.restoredDate || 'N/A'}"`,
    l.downtimeDays,
    `"${l.status}"`,
    `"${l.severity}"`,
    l.estimatedCost,
    `"${l.clientLiability}"`,
    `"${l.eventName || 'N/A'}"`,
    `"${(l.technicianNotes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `BINHI_Equipment_Maintenance_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
