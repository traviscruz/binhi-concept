import { useState } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { IconLogOut } from './icons';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  roleTitle?: string;
  userName?: string;
}

export function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
  roleTitle,
  userName,
}: LogoutModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } catch (err) {
      console.error('Logout confirm error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={loading ? undefined : onClose}>
      <div
        className="bg-white rounded-[2rem] border border-[#24252c]/10 shadow-2xl p-6 sm:p-7 max-w-sm w-[92vw] sm:w-full mx-auto relative text-center animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon Circle */}
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100/80 text-rose-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
          <IconLogOut className="w-6 h-6" />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--ink)] tracking-tight">
          Confirm Log Out
        </h3>
        <p className="text-xs sm:text-sm text-[#24252c]/60 mt-2 leading-relaxed">
          {userName ? (
            <>
              Are you sure you want to log out, <strong className="text-[var(--ink)]">{userName}</strong>?
            </>
          ) : roleTitle ? (
            <>
              Are you sure you want to end your <strong className="text-[var(--ink)]">{roleTitle}</strong> session?
            </>
          ) : (
            'Are you sure you want to sign out of your account?'
          )}
        </p>
        <p className="text-[11px] text-[#24252c]/40 mt-1">
          You will need to sign in again to access your dashboard.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-full border border-[#24252c]/15 text-[#24252c]/80 hover:text-[var(--ink)] hover:bg-[var(--mist)] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <IconLogOut className="w-3.5 h-3.5" />
                <span>Yes, Log Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
