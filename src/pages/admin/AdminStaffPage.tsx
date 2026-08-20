import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconUser, IconX } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: string;
}

export default function AdminStaffPage({ go }: { go: (p: Page) => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([
    { id: 'st-1', name: 'Francis Cruz', email: 'francis.cruz@binhi.ph', role: 'System Administrator', phone: '+63 917 111 2233', status: 'Active' },
    { id: 'st-2', name: 'Ely Buendia', email: 'ely.buendia@binhi.ph', role: 'Inventory Manager', phone: '+63 917 888 9900', status: 'Active' },
    { id: 'st-3', name: 'Marco Valenzuela', email: 'marco.v@binhi.ph', role: 'Crew', phone: '+63 918 555 4433', status: 'Active' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Event Staff / Crew');
  const [newEmail, setNewEmail] = useState('');

  // Edit Role Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editRoleVal, setEditRoleVal] = useState('Event Staff / Crew');

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setStaff([
      ...staff,
      { id: `st-${Date.now()}`, name: newName, email: newEmail || 'staff@binhi.ph', role: newRole, phone: '+63 917 000 0000', status: 'Active' },
    ]);

    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
  };

  const handleSaveEditRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setStaff((prev) =>
      prev.map((s) => (s.id === editingStaff.id ? { ...s, role: editRoleVal } : s))
    );

    setEditingStaff(null);
  };

  const toggleStaffStatus = (id: string) => {
    setStaff((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextStatus = s.status === 'Active' ? 'Disabled' : 'Active';
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconUser}>User & Staff Access</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Staff & Account Management
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Manage user accounts, assign system roles, and enable/disable crew access permissions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Add Staff Account
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
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
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{s.name}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-[var(--ink)]">{s.email}</div>
                    <div className="text-[10px] text-[#24252c]/50">{s.phone}</div>
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-[#1090F8]">{s.role}</td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        s.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingStaff(s);
                          setEditRoleVal(s.role);
                        }}
                        className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
                      >
                        Edit Role
                      </button>
                      <button
                        onClick={() => toggleStaffStatus(s.id)}
                        className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                          s.status === 'Active'
                            ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {s.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--ink)]">{s.name}</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    s.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <div className="text-[11px] text-[#24252c]/70">{s.email} ({s.phone})</div>
              <div className="text-[11px] font-semibold text-[#1090F8]">Role: {s.role}</div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-[#24252c]/10">
                <button
                  onClick={() => {
                    setEditingStaff(s);
                    setEditRoleVal(s.role);
                  }}
                  className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full text-[var(--ink)]"
                >
                  Edit Role
                </button>
                <button
                  onClick={() => toggleStaffStatus(s.id)}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-full border transition-colors ${
                    s.status === 'Active'
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {s.status === 'Active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setEditingStaff(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Staff System Role</h3>
            <p className="text-xs font-bold text-[#1090F8] mb-4">{editingStaff.name} ({editingStaff.email})</p>

            <form onSubmit={handleSaveEditRole} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Select System Role</label>
                <select
                  value={editRoleVal}
                  onChange={(e) => setEditRoleVal(e.target.value)}
                  className={inputClass + ' font-semibold'}
                >
                  <option>System Administrator</option>
                  <option>Inventory Manager</option>
                  <option>Crew</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Save Role Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-4">Add Staff Account</h3>

            <form onSubmit={handleAddStaff} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Full Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Rico Blanco" className={inputClass} required />
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Email Address</label>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="rico@binhi.ph" className={inputClass} required />
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">System Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputClass + ' font-semibold'}>
                  <option>System Administrator</option>
                  <option>Inventory Manager</option>
                  <option>Crew</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Create Staff Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
