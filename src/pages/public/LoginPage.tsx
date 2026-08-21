import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { MonoBadge } from '../../components/shared/Badges';
import { IconUser, IconEye, IconEyeOff, IconShield, IconLock } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../utils/supabase';
import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function LoginPage({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // First time login password change state
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingTargetPage, setPendingTargetPage] = useState<Page>('admin-dashboard');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

  const isSameAsCurrentPassword = Boolean(newPassword && password && newPassword === password);

  const isNewPasswordValid =
    validatePassword(newPassword).isValid &&
    newPassword === confirmPassword &&
    !isSameAsCurrentPassword;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Fetch user role and requires_password_change flag from public.profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, requires_password_change')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = profile?.role || user.user_metadata?.role || 'customer';
      const requiresPasswordChange =
        profile?.requires_password_change ??
        user.user_metadata?.requires_password_change ??
        user.user_metadata?.first_time_login ??
        false;

      setLoading(false);

      // Determine target portal page
      let target: Page = 'booking-tracker';
      if (localStorage.getItem('binhi_pending_checkout') === 'true' && userRole === 'customer') {
        target = 'checkout';
        localStorage.removeItem('binhi_pending_checkout');
      } else if (userRole === 'admin') target = 'admin-dashboard';
      else if (userRole === 'inventory_manager') target = 'inventory-dashboard';
      else if (userRole === 'crew') target = 'crew-assigned-bookings';

      const isStaffRole = ['admin', 'inventory_manager', 'crew'].includes(userRole);

      // Check if first-time password change is required for staff roles
      if (isStaffRole && requiresPasswordChange) {
        setPendingTargetPage(target);
        setShowForcePasswordModal(true);
        return;
      }

      go(target);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to log in. Please try again.');
      setLoading(false);
    }
  };

  // Submit new password for first-time login
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSameAsCurrentPassword) {
      setChangePasswordError('New password must be different from your current temporary password.');
      return;
    }

    if (!isNewPasswordValid) {
      setChangePasswordError('Password must meet all requirements and passwords must match.');
      return;
    }

    setChangePasswordLoading(true);
    setChangePasswordError('');

    try {
      // 1. Update password & user_metadata in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          requires_password_change: false,
          first_time_login: false,
        },
      });

      if (error) {
        setChangePasswordError(error.message);
        setChangePasswordLoading(false);
        return;
      }

      // 2. Update requires_password_change to false in public.profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            requires_password_change: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (dbError) {
          console.error('Error updating profiles requires_password_change:', dbError.message);
        }
      }

      setChangePasswordLoading(false);
      setShowForcePasswordModal(false);
      go(pendingTargetPage);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Failed to update password.');
      setChangePasswordLoading(false);
    }
  };

  return (
    <AuthShell
      badgeText="Log in"
      badgeIcon={IconUser}
      title="Welcome back"
      subtitle="Log in to track your bookings and rewards."
      onBack={() => go('landing')}
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {errorMsg}
          </div>
        )}

        <input
          type="email"
          required
          autoFocus
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass + ' pr-12'}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            'Log in'
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] space-y-3 text-center">
        <button
          type="button"
          onClick={() => go('forgot')}
          className="text-xs font-semibold text-[#24252c]/50 hover:text-[#1090F8] transition-colors"
        >
          Forgot your password?
        </button>
        <div className="text-sm text-[#24252c]/60">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => go('signup')}
            className="font-semibold text-[#1090F8] hover:underline"
          >
            Create one
          </button>
        </div>

        <div className="pt-3 border-t border-[#24252c]/[0.06] space-y-2">
          <button
            type="button"
            onClick={() => go('booking-tracker')}
            className="w-full bg-[#1090F8] text-white text-xs font-bold py-3 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Demo: Log in as Customer</span> →
          </button>
          <button
            type="button"
            onClick={() => go('inventory-dashboard')}
            className="w-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-all shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Demo: Log in as Inventory Manager</span> →
          </button>
          <button
            type="button"
            onClick={() => go('admin-dashboard')}
            className="w-full bg-[var(--ink)] text-white text-xs font-bold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-all shadow-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Demo: Log in as Admin (System Portal)</span> →
          </button>
          <button
            type="button"
            onClick={() => go('crew-assigned-bookings')}
            className="w-full bg-emerald-600 text-white text-xs font-bold py-3 rounded-full hover:bg-emerald-700 transition-all shadow-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Demo: Log in as Crew (Event Portal)</span> →
          </button>
        </div>
      </div>

      {/* MANDATORY FIRST-TIME PASSWORD CHANGE MODAL */}
      <ModalOverlay isOpen={showForcePasswordModal}>
        <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <div className="text-center mb-5">
            <span className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 font-bold text-lg flex items-center justify-center mx-auto mb-3">
              <IconShield className="w-6 h-6" />
            </span>
            <h3 className="text-2xl font-extrabold text-[var(--ink)]">First-Time Login</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              As an Admin logging in for the first time, you must replace your temporary initial password with a new personal password.
            </p>
          </div>

          {changePasswordError && (
            <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {changePasswordError}
            </div>
          )}

          <form onSubmit={handleForcePasswordChange} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass + ' pr-12 text-xs'}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
                >
                  {showNewPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass + ' pr-12 text-xs'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
                >
                  {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <PasswordChecklist password={newPassword} />

            {isSameAsCurrentPassword && (
              <p className="text-[11px] text-rose-500 font-semibold ml-2">
                New password must be different from your current temporary password.
              </p>
            )}

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-rose-500 ml-2">Passwords do not match.</p>
            )}

            <button
              type="submit"
              disabled={changePasswordLoading || !isNewPasswordValid}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {changePasswordLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Update Password & Continue'
              )}
            </button>
          </form>
        </div>
      </ModalOverlay>
    </AuthShell>
  );
}