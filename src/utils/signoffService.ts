import { supabase } from './supabase';
import { logAuditEvent } from './auditLogger';
import type { ClientSignOffData } from '../components/crew/ClientSignOffModal';

/**
 * Persists client digital sign-off to Supabase and browser cache.
 */
export async function saveClientSignOff(
  bookingId: string,
  data: ClientSignOffData
): Promise<{ success: boolean; error?: string }> {
  // 1. Local fallback cache for instant response
  try {
    localStorage.setItem(`binhi_crew_signoff_${bookingId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage save warning:', err);
  }

  // 2. Save directly to Supabase client_signoffs table (if created in Supabase)
  try {
    const { error: dbError } = await supabase.from('client_signoffs').upsert(
      {
        booking_id: bookingId,
        client_name: data.clientName,
        signer_role: data.signerRole,
        signature_url: data.signatureUrl,
        signed_at: new Date().toISOString(),
        verified_items: data.verifiedItems,
        notes: data.notes || '',
      },
      { onConflict: 'booking_id' }
    );
    if (dbError) {
      console.warn('Supabase client_signoffs upsert notice:', dbError.message);
    }
  } catch (err) {
    console.warn('Supabase signoff notice:', err);
  }

  // 3. Log to Supabase audit_logs table (guaranteed table in production Supabase)
  try {
    await logAuditEvent({
      module: 'crew',
      action: 'CLIENT_INGRESS_SIGNOFF',
      targetId: bookingId,
      targetName: data.clientName,
      details: `Client soundcheck sign-off completed by ${data.clientName} (${data.signerRole})`,
      currentData: {
        bookingId,
        clientName: data.clientName,
        signerRole: data.signerRole,
        signedAt: data.signedAt,
        verifiedItems: data.verifiedItems,
        notes: data.notes,
        signatureUrl: data.signatureUrl,
      },
      metadata: {
        verifiedCount: data.verifiedItems.length,
        hasNotes: Boolean(data.notes),
      },
    });
  } catch (auditErr) {
    console.warn('Supabase audit log notice:', auditErr);
  }

  return { success: true };
}

/**
 * Loads client sign-off record from Supabase (with fallback to local storage).
 */
export async function loadClientSignOff(
  bookingId: string
): Promise<ClientSignOffData | null> {
  // 1. Check Supabase client_signoffs table
  try {
    const { data, error } = await supabase
      .from('client_signoffs')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (!error && data) {
      return {
        clientName: data.client_name,
        signerRole: data.signer_role,
        signatureUrl: data.signature_url,
        signedAt: new Date(data.signed_at || data.created_at).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        verifiedItems: data.verified_items || [],
        notes: data.notes || '',
      };
    }
  } catch (err) {
    console.warn('Supabase client_signoffs lookup notice:', err);
  }

  // 2. Check Supabase audit_logs table
  try {
    const { data: auditData, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_id', bookingId)
      .eq('action', 'CLIENT_INGRESS_SIGNOFF')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!auditError && auditData?.current_data) {
      const cd = auditData.current_data;
      return {
        clientName: cd.clientName || auditData.target_name || 'Client',
        signerRole: cd.signerRole || 'Event Client / Host',
        signatureUrl: cd.signatureUrl,
        signedAt: cd.signedAt || new Date(auditData.timestamp).toLocaleString(),
        verifiedItems: cd.verifiedItems || [],
        notes: cd.notes || '',
      };
    }
  } catch (err) {
    console.warn('Supabase audit_logs lookup notice:', err);
  }

  // 3. Fallback to local storage
  try {
    const saved = localStorage.getItem(`binhi_crew_signoff_${bookingId}`);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('LocalStorage lookup notice:', err);
  }

  return null;
}
