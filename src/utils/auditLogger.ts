import { supabase } from '../utils/supabase';

export type AuditModule =
  | 'bookings'
  | 'packages'
  | 'crew'
  | 'staff'
  | 'vouchers'
  | 'transport'
  | 'inventory'
  | 'loyalty'
  | 'reviews'
  | 'system';

export type AuditAction =
  | 'UPDATE_PACKAGE_PRICE'
  | 'CREATE_PACKAGE'
  | 'DELETE_PACKAGE'
  | 'APPROVE_BOOKING_DEPOSIT'
  | 'UPDATE_BOOKING_STATUS'
  | 'ASSIGN_CREW'
  | 'RESCHEDULE_BOOKING'
  | 'SETTLE_BOOKING_BALANCE'
  | 'CANCEL_BOOKING'
  | 'CREATE_MANUAL_BOOKING'
  | 'CREATE_STAFF_ACCOUNT'
  | 'UPDATE_STAFF_ROLE'
  | 'UPDATE_STAFF_STATUS'
  | 'DELETE_STAFF_ACCOUNT'
  | 'CREATE_VOUCHER'
  | 'UPDATE_VOUCHER'
  | 'TOGGLE_VOUCHER_BANNER'
  | 'DELETE_VOUCHER'
  | 'CREATE_TRANSPORT_RULE'
  | 'UPDATE_TRANSPORT_RULE'
  | 'DELETE_TRANSPORT_RULE'
  | 'UPDATE_LOYALTY_SETTINGS'
  | 'MODERATE_REVIEW'
  | 'ASSIGN_EQUIPMENT_UNITS'
  | string;

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id?: string;
  user_name: string;
  user_email: string;
  user_role: string;
  action: AuditAction;
  module: AuditModule;
  target_id: string;
  target_name?: string;
  details: string;
  previous_data?: any;
  current_data?: any;
  metadata?: Record<string, any>;
  ip_address?: string;
}

export interface LogAuditParams {
  action: AuditAction;
  module: AuditModule;
  targetId: string;
  targetName?: string;
  details: string;
  previousData?: any;
  currentData?: any;
  metadata?: Record<string, any>;
}

const LOCAL_STORAGE_KEY = 'binhi_audit_logs_mirror';

// Cached user profile to avoid round-trips on rapid consecutive updates
let cachedActor: {
  id?: string;
  name: string;
  email: string;
  role: string;
  timestamp: number;
} | null = null;

/**
 * Resolves current actor information (Admin, Staff, or System)
 */
export async function getCurrentActor(): Promise<{
  id?: string;
  name: string;
  email: string;
  role: string;
}> {
  const now = Date.now();
  if (cachedActor && now - cachedActor.timestamp < 30000) {
    return cachedActor;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        name: 'System Admin',
        email: 'admin@binhiconcept.ph',
        role: 'admin',
      };
    }

    const meta = user.user_metadata || {};
    let name = meta.full_name || (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '');
    let role = meta.role || 'admin';
    const email = user.email || 'admin@binhiconcept.ph';

    // Check profiles table for freshest name & role
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.full_name) name = profile.full_name;
        else if (profile.first_name) name = `${profile.first_name} ${profile.last_name || ''}`.trim();
        if (profile.role) role = profile.role;
      }
    } catch {
      // Ignore profile query fallback
    }

    if (!name) {
      name = email.split('@')[0] || 'Admin';
    }

    cachedActor = {
      id: user.id,
      name,
      email,
      role,
      timestamp: now,
    };

    return cachedActor;
  } catch (err) {
    console.warn('Error resolving current audit actor:', err);
    return {
      name: 'System Admin',
      email: 'admin@binhiconcept.ph',
      role: 'admin',
    };
  }
}

/**
 * Log an audit event across any module in the system.
 * Immutable, resilient, with database insertion and local mirror.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<AuditLogEntry> {
  const actor = await getCurrentActor();
  const timestamp = new Date().toISOString();
  const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const entry: AuditLogEntry = {
    id,
    timestamp,
    user_id: actor.id,
    user_name: actor.name,
    user_email: actor.email,
    user_role: actor.role,
    action: params.action,
    module: params.module,
    target_id: params.targetId,
    target_name: params.targetName || params.targetId,
    details: params.details,
    previous_data: params.previousData ?? null,
    current_data: params.currentData ?? null,
    metadata: {
      ...(params.metadata || {}),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
    ip_address: 'Local/Client',
  };

  // 1. Immediately store in local mirror for zero-latency UI display
  try {
    const existing = getLocalAuditMirror();
    const updated = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, 500);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (storageErr) {
    console.warn('Audit local mirror error:', storageErr);
  }

  // 2. Dispatch custom event for real-time reactivity in UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit-logs-updated', { detail: entry }));
  }

  // 3. Asynchronously persist to Supabase public.audit_logs table
  try {
    const dbPayload: any = {
      user_id: entry.user_id,
      user_name: entry.user_name,
      user_email: entry.user_email,
      user_role: entry.user_role,
      action: entry.action,
      module: entry.module,
      target_id: entry.target_id,
      target_name: entry.target_name,
      details: entry.details,
      previous_data: entry.previous_data,
      current_data: entry.current_data,
      metadata: entry.metadata,
      timestamp: entry.timestamp,
    };

    const { error } = await supabase.from('audit_logs').insert(dbPayload);
    if (error) {
      console.warn('Supabase audit_logs insert warning (local mirror active):', error.message);
    }
  } catch (dbErr) {
    console.warn('Supabase audit log persistence notice:', dbErr);
  }

  return entry;
}

/**
 * Get local mirror of audit logs from localStorage
 */
export function getLocalAuditMirror(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Fetch audit logs from Supabase with local mirror merge
 */
export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const localLogs = getLocalAuditMirror();

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(300);

    if (!error && data) {
      const dbLogs: AuditLogEntry[] = data.map((d: any) => ({
        id: d.id,
        timestamp: d.timestamp || d.created_at || new Date().toISOString(),
        user_id: d.user_id,
        user_name: d.user_name || (d.user_email ? d.user_email.split('@')[0] : 'Staff'),
        user_email: d.user_email || 'admin@binhiconcept.ph',
        user_role: d.user_role || 'admin',
        action: d.action,
        module: d.module || 'general',
        target_id: d.target_id || '',
        target_name: d.target_name || d.target_id || '',
        details: d.details || '',
        previous_data: d.previous_data || null,
        current_data: d.current_data || null,
        metadata: d.metadata || {},
        ip_address: d.ip_address || '',
      }));

      // 1. Deduplicate DB logs in case of double-insert or network retry
      const dedupedDbLogs: AuditLogEntry[] = [];
      const seenDb = new Set<string>();

      dbLogs.forEach((l) => {
        // Time rounded to 3-second bucket
        const timeBucket = Math.floor(new Date(l.timestamp).getTime() / 3000);
        const key = `${timeBucket}-${l.action}-${l.target_id}-${l.details}`;
        if (!seenDb.has(key)) {
          seenDb.add(key);
          dedupedDbLogs.push(l);
        }
      });

      // 2. Filter out local mirror items that already exist in DB
      const isAlreadyInDb = (localLog: AuditLogEntry) => {
        const localTime = new Date(localLog.timestamp).getTime();
        return dedupedDbLogs.some((dbLog) => {
          if (dbLog.id === localLog.id) return true;
          if (dbLog.action === localLog.action && dbLog.target_id === localLog.target_id) {
            const dbTime = new Date(dbLog.timestamp).getTime();
            // Same action and target within 5 seconds = exact same event
            if (Math.abs(dbTime - localTime) < 5000) return true;
          }
          return false;
        });
      };

      const pendingLocal = localLogs.filter((l) => !isAlreadyInDb(l));

      // 3. Prune local mirror in localStorage to remove already-synced entries
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pendingLocal));
      } catch {}

      // 4. Combine clean DB logs + pending local entries
      const combined = [...dedupedDbLogs, ...pendingLocal];
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return combined;
    }
  } catch (err) {
    console.warn('Note reading Supabase audit_logs, using mirror fallback:', err);
  }

  return localLogs;
}

/**
 * Export audit logs to CSV
 */
export function exportAuditLogsToCsv(logs: AuditLogEntry[]) {
  const headers = [
    'Timestamp',
    'User Name',
    'User Email',
    'Role',
    'Module',
    'Action',
    'Target ID',
    'Target Name',
    'Details',
    'Previous Values',
    'Current Values',
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = logs.map((l) => [
    escapeCsv(new Date(l.timestamp).toLocaleString()),
    escapeCsv(l.user_name),
    escapeCsv(l.user_email),
    escapeCsv(l.user_role),
    escapeCsv(l.module),
    escapeCsv(l.action),
    escapeCsv(l.target_id),
    escapeCsv(l.target_name),
    escapeCsv(l.details),
    escapeCsv(l.previous_data ? JSON.stringify(l.previous_data) : ''),
    escapeCsv(l.current_data ? JSON.stringify(l.current_data) : ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `binhi_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
