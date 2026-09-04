import { supabase } from './supabase';
import { logAuditEvent } from './auditLogger';

export interface SetupStage {
  id: string;
  stepNum: number;
  title: string;
  desc: string;
  completed: boolean;
  completedAt?: string;
  verifiedBy?: string;
}

export const DEFAULT_STAGE_TEMPLATES: Omit<SetupStage, 'completed' | 'completedAt'>[] = [
  {
    id: 'st-1',
    stepNum: 1,
    title: 'Warehouse Packing & Dispatch',
    desc: 'Verify all physical units against packing checklist, load rigging truck, and dispatch from warehouse.',
  },
  {
    id: 'st-2',
    stepNum: 2,
    title: 'On-Site Stage Rigging & Cable Run',
    desc: 'Unload gear at venue, position speaker stands, mount LED panels to truss, and lay XLR multi-snake cable runs.',
  },
  {
    id: 'st-3',
    stepNum: 3,
    title: 'Sound & LED Display Calibration Test',
    desc: 'Perform pink noise speaker tuning, test wireless mics, calibrate LED video wall brightness, and test low-fog hazer.',
  },
  {
    id: 'st-4',
    stepNum: 4,
    title: 'Live Event Production Support',
    desc: 'Standby on-site for live sound mixing, stage light cues, and technical troubleshooting throughout the event duration.',
  },
  {
    id: 'st-5',
    stepNum: 5,
    title: 'Teardown, Inventory Audit & Return',
    desc: 'Dismantle stage equipment, pack back into flight cases, audit serial IDs, and return to warehouse shelf storage.',
  },
];

export function computeOverallWorkflowStatus(stages: SetupStage[], hasSignOff: boolean = false): string {
  const completedCount = stages.filter((s) => s.completed).length;
  if (completedCount === stages.length && stages.length > 0) {
    return 'Teardown Complete';
  }
  if (hasSignOff || (completedCount >= 3 && stages[2]?.completed)) {
    return 'Setup Complete';
  }
  if (completedCount > 0) {
    return 'Setup In Progress';
  }
  return 'Pending Setup';
}

/**
 * Load workflow stages for a booking from Supabase public.bookings / booking_workflow_stages
 * with fallback to localStorage.
 */
export async function loadBookingWorkflowStages(
  bookingId: string,
  currentSignOff: any = null
): Promise<{ stages: SetupStage[]; status: string }> {
  const cleanId = (bookingId || '').trim();
  if (!cleanId) {
    return {
      stages: DEFAULT_STAGE_TEMPLATES.map((t) => ({ ...t, completed: false })),
      status: 'Pending Setup',
    };
  }

  // 1. Try to load directly from Supabase bookings table
  try {
    const { data: allBookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, paymongo_reference_number, setup_stages, setup_status, payment_status');

    if (!bErr && allBookings) {
      const bMatch = allBookings.find(
        (b) =>
          b.paymongo_reference_number === cleanId ||
          b.id === cleanId ||
          `BNH-${b.id.slice(0, 8)}` === cleanId ||
          b.id.slice(0, 8) === cleanId.replace('BNH-', '')
      );

      if (bMatch && Array.isArray(bMatch.setup_stages) && bMatch.setup_stages.length > 0) {
        const stages = bMatch.setup_stages;
        const status = bMatch.setup_status || computeOverallWorkflowStatus(stages, Boolean(currentSignOff));
        // Cache locally
        try {
          localStorage.setItem(`binhi_crew_stages_${cleanId}`, JSON.stringify(stages));
        } catch {}
        return { stages, status };
      }
    }
  } catch (err) {
    console.warn('Database workflow stages fetch notice:', err);
  }

  // 2. Check booking_workflow_stages table
  try {
    const { data: stageRows, error: sErr } = await supabase
      .from('booking_workflow_stages')
      .select('*')
      .eq('booking_id', cleanId)
      .order('step_num', { ascending: true });

    if (!sErr && Array.isArray(stageRows) && stageRows.length > 0) {
      const stages: SetupStage[] = stageRows.map((r: any) => ({
        id: r.stage_id,
        stepNum: r.step_num,
        title: r.title,
        desc: r.description || '',
        completed: Boolean(r.completed),
        completedAt: r.completed_at || undefined,
        verifiedBy: r.verified_by || undefined,
      }));
      const status = computeOverallWorkflowStatus(stages, Boolean(currentSignOff));
      try {
        localStorage.setItem(`binhi_crew_stages_${cleanId}`, JSON.stringify(stages));
      } catch {}
      return { stages, status };
    }
  } catch (err) {
    console.warn('Table booking_workflow_stages lookup notice:', err);
  }

  // 3. Fallback to LocalStorage
  try {
    const local = localStorage.getItem(`binhi_crew_stages_${cleanId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          stages: parsed,
          status: computeOverallWorkflowStatus(parsed, Boolean(currentSignOff)),
        };
      }
    }
  } catch {}

  // 4. Default fresh template
  const defaultStages: SetupStage[] = DEFAULT_STAGE_TEMPLATES.map((t, idx) => ({
    ...t,
    completed: idx === 2 ? Boolean(currentSignOff) : false,
    completedAt: idx === 2 && currentSignOff ? currentSignOff.signedAt : undefined,
  }));

  return {
    stages: defaultStages,
    status: computeOverallWorkflowStatus(defaultStages, Boolean(currentSignOff)),
  };
}

/**
 * Persist workflow stages to Supabase database (bookings table + booking_workflow_stages)
 * and sync with local cache & audit logs.
 */
export async function saveBookingWorkflowStages(
  bookingId: string,
  stages: SetupStage[],
  options?: {
    verifiedBy?: string;
    hasSignOff?: boolean;
    bookingCustomer?: string;
  }
): Promise<{ success: boolean; overallStatus: string; error?: string }> {
  const cleanId = (bookingId || '').trim();
  const overallStatus = computeOverallWorkflowStatus(stages, options?.hasSignOff);

  // 1. Save to localStorage for immediate UI responsiveness
  try {
    localStorage.setItem(`binhi_crew_stages_${cleanId}`, JSON.stringify(stages));
  } catch (err) {
    console.warn('LocalStorage save warning:', err);
  }

  // 2. Resolve booking and update public.bookings in Supabase
  try {
    const { data: allBookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, paymongo_reference_number');

    if (!bErr && allBookings) {
      const target = allBookings.find(
        (b) =>
          b.paymongo_reference_number === cleanId ||
          b.id === cleanId ||
          `BNH-${b.id.slice(0, 8)}` === cleanId ||
          b.id.slice(0, 8) === cleanId.replace('BNH-', '')
      );

      if (target) {
        const { error: updateErr } = await supabase
          .from('bookings')
          .update({
            setup_stages: stages,
            setup_status: overallStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', target.id);

        if (updateErr) {
          console.warn('Supabase bookings setup_stages update warning:', updateErr.message);
        }
      }
    }
  } catch (err) {
    console.warn('Supabase bookings update warning:', err);
  }

  // 3. Upsert granular stage events into public.booking_workflow_stages (if table exists)
  try {
    const stagePayloads = stages.map((st) => ({
      booking_id: cleanId,
      stage_id: st.id,
      step_num: st.stepNum,
      title: st.title,
      description: st.desc,
      completed: st.completed,
      completed_at: st.completedAt || null,
      verified_by: st.verifiedBy || options?.verifiedBy || 'Crew Technician',
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await supabase
      .from('booking_workflow_stages')
      .upsert(stagePayloads, { onConflict: 'booking_id, stage_id' });

    if (upsertErr) {
      console.warn('Supabase booking_workflow_stages upsert notice:', upsertErr.message);
    }
  } catch (err) {
    console.warn('booking_workflow_stages table notice:', err);
  }

  // 4. Log Immutable Audit Log
  const completedCount = stages.filter((s) => s.completed).length;
  try {
    await logAuditEvent({
      module: 'crew',
      action: 'UPDATE_BOOKING',
      targetId: cleanId,
      targetName: options?.bookingCustomer || `Booking #${cleanId}`,
      details: `Setup & Teardown Stage updated: ${completedCount}/${stages.length} stages completed. Status: "${overallStatus}"`,
      currentData: {
        bookingId: cleanId,
        completedStages: completedCount,
        totalStages: stages.length,
        overallStatus,
        verifiedBy: options?.verifiedBy,
      },
      metadata: {
        overall_status: overallStatus,
        progress_percentage: Math.round((completedCount / stages.length) * 100),
      },
    });
  } catch (auditErr) {
    console.warn('Audit log notice:', auditErr);
  }

  return { success: true, overallStatus };
}
