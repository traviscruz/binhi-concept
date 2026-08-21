import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconUser, IconX, IconSearch, IconShield } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../utils/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: string;
  requiresPasswordChange?: boolean;
  hasNeverLoggedIn?: boolean;
}

// Generate random secure temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pass = 'Binhi#';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function AdminStaffPage({ go }: { go: (p: Page) => void }) {
  // Real Supabase State (No hardcoded mock initial state)
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Add Staff Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Admin' | 'Inventory Manager' | 'Crew'>('Crew');

  // Add Confirmation Modal State
  const [pendingAddStaff, setPendingAddStaff] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    tempPassword: string;
  } | null>(null);

  // Status Change Confirmation Modal State
  const [pendingStatusToggle, setPendingStatusToggle] = useState<StaffMember | null>(null);

  // Edit Role Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editRoleVal, setEditRoleVal] = useState<string>('Crew');

  // Delete Staff Modal State
  const [pendingDeleteStaff, setPendingDeleteStaff] = useState<StaffMember | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setFeedbackVisible(true);
  };

  const handleCloseFeedback = () => {
    setFeedbackVisible(false);
    setTimeout(() => setFeedbackMsg(null), 300);
  };

  useEffect(() => {
    if (!feedbackMsg) return;
    const duration = feedbackMsg.text.includes('Temporary Initial Password') ? 12000 : 5000;
    const timer = setTimeout(() => {
      setFeedbackVisible(false);
      const clearTimer = setTimeout(() => {
        setFeedbackMsg(null);
      }, 300);
      return () => clearTimeout(clearTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  const handleConfirmDeleteStaff = async () => {
    if (!pendingDeleteStaff) return;

    try {
      // Deletes the Auth user AND the public.profiles record
      await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'delete',
          userId: pendingDeleteStaff.id,
        },
      });
    } catch (err) {
      console.warn('Delete staff notice:', err);
    }

    setStaff((prev) => prev.filter((s) => s.id !== pendingDeleteStaff.id));
    showFeedback(
      'success',
      `Staff account for ${pendingDeleteStaff.name} (${pendingDeleteStaff.email}) removed successfully from system and authentication directory.`
    );
    setPendingDeleteStaff(null);
  };

  // Fetch real staff profiles from Supabase on mount
  useEffect(() => {
    // 1. Fetch immediately
    fetchStaffFromSupabase();

    // 2. Fetch logged-in user email once to show "(You)" tag
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserEmail(user.email || null);
      }
    });
  }, []);

  const fetchStaffFromSupabase = async () => {
    setLoadingStaff(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('list-staff');

      console.log('[fetchStaffFromSupabase] fnData:', fnData, 'fnError:', fnError);
      const data = fnData?.staff || [];
      console.log('[fetchStaffFromSupabase] Extracted staff data:', data);

      if (data) {
        const formatted: StaffMember[] = data.map((item: any) => {
          let displayRole = 'Crew';
          if (item.role === 'admin') displayRole = 'Admin';
          else if (item.role === 'inventory_manager') displayRole = 'Inventory Manager';

          const fName = item.first_name || item.email?.split('@')[0] || 'Staff';
          const lName = item.last_name || 'Member';

          return {
            id: item.id,
            firstName: fName,
            lastName: lName,
            name: `${fName} ${lName}`,
            email: item.email || 'staff@binhi.ph',
            phone: item.phone || 'N/A',
            role: displayRole,
            status: item.is_disabled ? 'Disabled' : 'Active',
            requiresPasswordChange: item.requires_password_change ?? false,
            hasNeverLoggedIn: item.has_never_logged_in ?? false,
          };
        });
        setStaff(formatted);
      }
    } catch (err) {
      console.warn('Supabase profiles query notice:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Trigger Confirmation for Adding Staff
  const handleInitiateAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;

    const tempPassword = generateTempPassword();

    setPendingAddStaff({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() ? `+63 ${phone.trim()}` : 'N/A',
      role,
      tempPassword,
    });
  };

  // Final Confirmation of Account Creation
  const handleConfirmCreateStaff = async () => {
    if (!pendingAddStaff) return;
    setLoading(true);

    const fullObj: StaffMember = {
      id: `st-${Date.now()}`,
      firstName: pendingAddStaff.firstName,
      lastName: pendingAddStaff.lastName,
      name: `${pendingAddStaff.firstName} ${pendingAddStaff.lastName}`,
      email: pendingAddStaff.email,
      phone: pendingAddStaff.phone,
      role: pendingAddStaff.role,
      status: 'Active',
      requiresPasswordChange: true,
      hasNeverLoggedIn: true,
    };

    try {
      let roleDb = 'crew';
      if (pendingAddStaff.role === 'Admin') roleDb = 'admin';
      else if (pendingAddStaff.role === 'Inventory Manager') roleDb = 'inventory_manager';

      // Call Unified Edge Function — action: 'invite'
      console.log('[manage-staff] Inviting staff:', pendingAddStaff.email);
      const { data: fnData, error: fnError } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'invite',
          email: pendingAddStaff.email,
          firstName: pendingAddStaff.firstName,
          lastName: pendingAddStaff.lastName,
          phone: pendingAddStaff.phone,
          role: roleDb,
          tempPassword: pendingAddStaff.tempPassword,
        },
      });

      console.log('[manage-staff] invite response:', fnData, fnError);

      if (fnError) {
        console.error('[manage-staff] invite error:', fnError.message);
      } else if (fnData?.error) {
        console.error('[manage-staff] invite returned error:', fnData.error);
      } else if (fnData?.userId) {
        fullObj.id = fnData.userId;
      }
    } catch (err) {
      console.error('[manage-staff] Invite caught exception:', err);
    }

    setStaff((prev) => [fullObj, ...prev]);
    setLoading(false);
    setPendingAddStaff(null);
    setShowAddModal(false);

    // Reset Form
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('Crew');

    showFeedback(
      'success',
      `Staff account for ${fullObj.name} (${fullObj.email}) created! Temporary Initial Password: ${pendingAddStaff.tempPassword}. First-time password change is required upon login.`
    );
  };

  // Confirm Toggle Active/Disabled Status
  const handleConfirmToggleStatus = async () => {
    if (!pendingStatusToggle) return;

    // Safety check: Cannot toggle own status
    if (pendingStatusToggle.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
      showFeedback('error', 'Security block: You cannot disable your own account.');
      setPendingStatusToggle(null);
      return;
    }

    setLoading(true);
    const newStatus = pendingStatusToggle.status === 'Active' ? 'Disabled' : 'Active';
    const isDisabled = newStatus === 'Disabled';

    try {
      // Call Unified Edge Function — action: 'toggle-status'
      await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'toggle-status',
          userId: pendingStatusToggle.id,
          isDisabled,
        },
      });
    } catch (err) {
      console.warn('Supabase status update note:', err);
    }

    setStaff((prev) =>
      prev.map((s) => (s.id === pendingStatusToggle.id ? { ...s, status: newStatus } : s))
    );
    setLoading(false);

    showFeedback('success', `Account for ${pendingStatusToggle.name} has been set to ${newStatus}.`);
    setPendingStatusToggle(null);
  };

  // Save Role Edit
  const handleSaveEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setLoading(true);
    let roleDb = 'crew';
    if (editRoleVal === 'Admin') roleDb = 'admin';
    else if (editRoleVal === 'Inventory Manager') roleDb = 'inventory_manager';

    try {
      // Call Unified Edge Function — action: 'update-role'
      await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update-role',
          userId: editingStaff.id,
          role: roleDb,
        },
      });
    } catch (err) {
      console.warn('Supabase role update note:', err);
    }

    setStaff((prev) =>
      prev.map((s) => (s.id === editingStaff.id ? { ...s, role: editRoleVal } : s))
    );
    setLoading(false);

    setEditingStaff(null);
    showFeedback('success', `Assigned role for ${editingStaff.name} updated to ${editRoleVal}.`);
  };

  // Filter Staff Members
  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'All' || s.role === roleFilter;
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Unverified' && s.hasNeverLoggedIn && s.status !== 'Disabled') ||
      (statusFilter === 'Active' && !s.hasNeverLoggedIn && s.status !== 'Disabled') ||
      (statusFilter === 'Disabled' && s.status === 'Disabled');

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Fallback helpers to prevent crashes during modal zoom-out exit animations
  const activeAddStaff = pendingAddStaff || { firstName: '', lastName: '', email: '', phone: '', role: '', tempPassword: '' };
  const activeStatusToggle = pendingStatusToggle || { name: '', role: '', status: '' };
  const activeEditingStaff = editingStaff || { name: '', email: '', role: '' };
  const activeDeleteStaff = pendingDeleteStaff || { name: '', email: '' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconUser}>User & Staff Access</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Staff & Account Management
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Provision staff user accounts, configure system roles, and manage active/disabled access permissions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          + Add Staff Account
        </button>
      </div>

      {/* Alert Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all duration-300 ease-in-out ${
            feedbackVisible
              ? 'opacity-100 translate-y-0 max-h-40 p-4 mb-6 border-current'
              : 'opacity-0 -translate-y-2 max-h-0 p-0 mb-0 border-transparent overflow-hidden'
          } ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={handleCloseFeedback} className="text-[#24252c]/40 hover:text-[var(--ink)] p-1 cursor-pointer shrink-0 ml-4">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
          {/* Role Filters */}
          <div className="flex items-center gap-1 bg-[var(--mist)] p-1 rounded-full border border-[#24252c]/[0.06]">
            {['All', 'Admin', 'Inventory Manager', 'Crew'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                    : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-[var(--mist)] p-1 rounded-full border border-[#24252c]/[0.06]">
            {['All', 'Active', 'Unverified', 'Disabled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#1090F8] text-white shadow-sm font-semibold'
                    : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, role..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Staff Members Table */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {loadingStaff ? (
          <div className="py-12 text-center text-xs text-[#24252c]/50">
            <span className="inline-block w-5 h-5 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mb-2" />
            <div>Loading staff accounts...</div>
          </div>
        ) : filteredStaff.length === 0 ? (
          <EmptyState
            title={staff.length === 0 ? 'No Staff Accounts Provisioned' : 'No Matching Staff Records'}
            description={
              staff.length === 0
                ? 'Click "+ Add Staff Account" above to provision system access for your team members.'
                : 'No staff accounts match your search keywords or filter criteria.'
            }
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                    <th className="py-3 px-3 font-semibold">User Name</th>
                    <th className="py-3 px-3 font-semibold">Email & Phone</th>
                    <th className="py-3 px-3 font-semibold">Assigned Role</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--mist)] transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                          {s.name}
                          {s.email.toLowerCase() === currentUserEmail?.toLowerCase() && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-[var(--ink)]">{s.email}</div>
                        <div className="text-[10px] text-[#24252c]/50">{s.phone}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] font-extrabold px-3 py-1 rounded-full border inline-block ${
                            s.role === 'Admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : s.role === 'Inventory Manager'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block w-fit ${
                              s.status === 'Disabled'
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                : s.hasNeverLoggedIn
                                ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            }`}
                          >
                            {s.status === 'Disabled' ? 'Disabled' : s.hasNeverLoggedIn ? 'Unverified' : 'Active'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.email.toLowerCase() === currentUserEmail?.toLowerCase() ? (
                            <span className="text-[10px] text-[#24252c]/40 font-semibold italic pr-3 uppercase tracking-wider select-none">
                              Self Account
                            </span>
                          ) : s.hasNeverLoggedIn ? (
                            <button
                              onClick={() => setPendingDeleteStaff(s)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                            >
                              Delete Account
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingStaff(s);
                                  setEditRoleVal(s.role);
                                }}
                                className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                              >
                                Edit Role
                              </button>
                              <button
                                onClick={() => setPendingStatusToggle(s)}
                                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                                  s.status === 'Active'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {s.status === 'Active' ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => setPendingDeleteStaff(s)}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Row Cards View */}
            <div className="block sm:hidden space-y-3">
              {filteredStaff.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                      {s.name}
                      {s.email.toLowerCase() === currentUserEmail?.toLowerCase() && (
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        s.status === 'Disabled'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : s.hasNeverLoggedIn
                          ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}
                    >
                      {s.status === 'Disabled' ? 'Disabled' : s.hasNeverLoggedIn ? 'Unverified' : 'Active'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#24252c]/70">{s.email} ({s.phone})</div>
                  <div className="text-[11px] font-semibold text-[#1090F8]">Role: {s.role}</div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#24252c]/10 justify-end">
                    {s.email.toLowerCase() === currentUserEmail?.toLowerCase() ? (
                      <span className="text-[10px] text-[#24252c]/40 font-semibold italic uppercase tracking-wider select-none py-1">
                        Self Account
                      </span>
                    ) : s.hasNeverLoggedIn ? (
                      <button
                        onClick={() => setPendingDeleteStaff(s)}
                        className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-semibold py-1.5 rounded-full transition-colors cursor-pointer text-center"
                      >
                        Delete Account
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingStaff(s);
                            setEditRoleVal(s.role);
                          }}
                          className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full text-[var(--ink)] cursor-pointer"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => setPendingStatusToggle(s)}
                          className={`flex-1 text-xs font-semibold py-1.5 rounded-full border transition-colors cursor-pointer ${
                            s.status === 'Active'
                              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {s.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: ADD STAFF FORM MODAL */}
      <ModalOverlay isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>

          <div className="mb-5">
            <h3 className="text-xl font-extrabold text-[var(--ink)]">Add Staff Account</h3>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Enter member details. A random temporary password & email OTP verification code will be dispatched to their email address.
            </p>
          </div>

          <form onSubmit={handleInitiateAddStaff} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rico"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Blanco"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Email Address (Required)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rico.blanco@binhi.ph"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Phone Number <span className="text-[#24252c]/40 font-normal">(Optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="bg-[#EEEEEE] text-[var(--ink)] font-bold text-xs px-3.5 py-2.5 rounded-full border border-transparent shrink-0">
                  +63
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="917 123 4567"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Assigned System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className={inputClass + ' font-semibold'}
              >
                <option value="Admin">Admin</option>
                <option value="Inventory Manager">Inventory Manager</option>
                <option value="Crew">Crew</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-md"
              >
                Proceed to Confirmation
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* MODAL 2: CREATE STAFF CONFIRMATION MODAL */}
      <ModalOverlay isOpen={!!pendingAddStaff} onClose={() => setPendingAddStaff(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-left">
          <button
            onClick={() => setPendingAddStaff(null)}
            className="absolute top-6 right-6 text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          {/* Top Security Header Badge */}
          <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-[#24252c]/[0.08]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--ink)] text-white flex items-center justify-center shrink-0 shadow-md border border-white/10">
              <IconShield className="w-6 h-6 text-[#1090F8]" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-[#1090F8] uppercase block">
                Action Required
              </span>
              <h3 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
                Confirm Staff Provisioning
              </h3>
            </div>
          </div>

          <p className="text-xs text-[#24252c]/70 leading-relaxed mb-4">
            You are about to authorize access credentials for a new team member. Please verify the profile details below before finalizing.
          </p>

          {/* Summary Card */}
          <div className="bg-[var(--mist)] border border-[#24252c]/[0.06] rounded-3xl p-4.5 space-y-3 mb-5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#24252c]/[0.04]">
              <span className="text-[#24252c]/50 font-semibold uppercase text-[10px] tracking-wider">Full Name</span>
              <span className="font-extrabold text-[var(--ink)]">
                {activeAddStaff.firstName} {activeAddStaff.lastName}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#24252c]/[0.04]">
              <span className="text-[#24252c]/50 font-semibold uppercase text-[10px] tracking-wider">Email Address</span>
              <span className="font-bold text-[var(--ink)]">{activeAddStaff.email}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#24252c]/[0.04]">
              <span className="text-[#24252c]/50 font-semibold uppercase text-[10px] tracking-wider">Phone Number</span>
              <span className="font-bold text-[var(--ink)]">{activeAddStaff.phone}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#24252c]/[0.04]">
              <span className="text-[#24252c]/50 font-semibold uppercase text-[10px] tracking-wider">Temporary Password</span>
              <span className="font-extrabold text-[var(--ink)] font-mono tracking-wider">{activeAddStaff.tempPassword}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#24252c]/50 font-semibold uppercase text-[10px] tracking-wider">System Role</span>
              <span
                className={`text-[10px] font-extrabold px-3 py-0.5 rounded-full border ${
                  activeAddStaff.role === 'Admin'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : activeAddStaff.role === 'Inventory Manager'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {activeAddStaff.role}
              </span>
            </div>
          </div>

          {/* Security Notice Alert */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl mb-6 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <IconShield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block text-amber-950 mb-0.5">Automated Dispatch Notice</strong>
              A staff invitation email containing the temporary password will be dispatched to this address. The user will be required to set a new password upon first login.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setPendingAddStaff(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-bold py-3.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-all cursor-pointer"
            >
              Back / Edit
            </button>
            <button
              onClick={handleConfirmCreateStaff}
              disabled={loading}
              className="flex-1 bg-[#1090F8] text-white font-extrabold py-3.5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirm & Create'
              )}
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* MODAL 3: DISABLE / ENABLE CONFIRMATION MODAL */}
      <ModalOverlay isOpen={!!pendingStatusToggle} onClose={() => setPendingStatusToggle(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button onClick={() => setPendingStatusToggle(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>

          <div
            className={`w-12 h-12 rounded-full font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border ${
              activeStatusToggle.status === 'Active'
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
          >
            !
          </div>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">
            {activeStatusToggle.status === 'Active' ? 'Disable Staff Account?' : 'Enable Staff Account?'}
          </h3>
          <p className="text-xs text-[#24252c]/60 mb-5 leading-relaxed">
            {activeStatusToggle.status === 'Active'
              ? `Are you sure you want to disable access for ${activeStatusToggle.name} (${activeStatusToggle.role})? They will be blocked from logging into the portal.`
              : `Re-activate system access for ${activeStatusToggle.name} (${activeStatusToggle.role})?`}
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setPendingStatusToggle(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmToggleStatus}
              className={`flex-1 text-white font-semibold py-3 rounded-full transition-colors shadow-md cursor-pointer ${
                activeStatusToggle.status === 'Active'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {activeStatusToggle.status === 'Active' ? 'Yes, Disable Account' : 'Yes, Enable Account'}
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* MODAL 4: EDIT ROLE MODAL */}
      <ModalOverlay isOpen={!!editingStaff} onClose={() => setEditingStaff(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button onClick={() => setEditingStaff(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit System Role</h3>
          <p className="text-xs font-bold text-[#1090F8] mb-4">Target User: {activeEditingStaff.name} ({activeEditingStaff.email})</p>

          <form onSubmit={handleSaveEditRole} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Select System Role</label>
              <select
                value={editRoleVal}
                onChange={(e) => setEditRoleVal(e.target.value)}
                className={inputClass + ' font-semibold'}
              >
                <option value="Admin">Admin</option>
                <option value="Inventory Manager">Inventory Manager</option>
                <option value="Crew">Crew</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-md"
            >
              Save Role Assignment
            </button>
          </form>
        </div>
      </ModalOverlay>

      {/* MODAL 5: DELETE STAFF CONFIRMATION MODAL */}
      <ModalOverlay isOpen={!!pendingDeleteStaff} onClose={() => setPendingDeleteStaff(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button
            onClick={() => setPendingDeleteStaff(null)}
            className="absolute top-6 right-6 text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
            !
          </div>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Delete Staff Account?</h3>
          <p className="text-xs text-[#24252c]/60 mb-5 leading-relaxed">
            Are you sure you want to delete staff account <strong className="text-[var(--ink)] font-bold">{activeDeleteStaff.name}</strong> ({activeDeleteStaff.email})? This action will remove their access permissions.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setPendingDeleteStaff(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeleteStaff}
              className="flex-1 bg-rose-600 text-white font-extrabold py-3.5 rounded-full hover:bg-rose-700 transition-all shadow-md cursor-pointer"
            >
              Yes, Delete Account
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
