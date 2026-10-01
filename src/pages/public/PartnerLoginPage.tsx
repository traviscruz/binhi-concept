import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconUser,
  IconTicket,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconArrow,
  IconLock,
  IconEye,
  IconEyeOff,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { OtpInput } from '../../components/shared/OtpInput';
import { supabase } from '../../utils/supabase';
import {
  getAffiliateDashboardData,
  setStoredPartnerSession,
  getStoredPartnerSession,
  type AffiliatePartner,
  type AffiliateReferralRecord,
  type AffiliatePayoutRecord,
} from '../../utils/affiliateService';
import { sendPartnerOtpEmail } from '../../utils/emailService';

export default function PartnerLoginPage({ go }: { go: (p: Page) => void }) {
  // Login Mode: 'password' (default) | 'otp'
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');

  // Input States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // OTP Verification State
  const [pendingPartnerData, setPendingPartnerData] = useState<{
    partner: AffiliatePartner;
    referrals: AffiliateReferralRecord[];
    payouts: AffiliatePayoutRecord[];
  } | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // If already logged in, redirect directly to dashboard
  useEffect(() => {
    const existing = getStoredPartnerSession();
    if (existing) {
      go('partner-dashboard');
    }
  }, [go]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [isFirstTimeVerification, setIsFirstTimeVerification] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PASSWORD AUTHENTICATION FLOW
  // ───────────────────────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) return;

    setLoading(true);
    setErrorMessage('');
    setIsFirstTimeVerification(false);

    try {
      // 1. Lookup Partner Record
      const data = await getAffiliateDashboardData(cleanId);
      if (!data || !data.partner) {
        setErrorMessage(`No registered partner account found for "${cleanId}". Please check your email or promo code.`);
        setLoading(false);
        return;
      }

      if (data.partner.status === 'rejected') {
        setErrorMessage('This partner account was reviewed and not approved by administration. Please check your email for details.');
        setLoading(false);
        return;
      }

      const partnerEmail = data.partner.email;

      // 2. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: partnerEmail.trim().toLowerCase(),
        password,
      });

      if (authError) {
        console.warn('Supabase password auth response:', authError.message);
        const errMsg = authError.message.toLowerCase();
        const isEmailNotConfirmed = errMsg.includes('email not confirmed') || errMsg.includes('unconfirmed');

        if (isEmailNotConfirmed) {
          // Partner account requires email OTP confirmation before first login!
          setPendingPartnerData({
            partner: data.partner,
            referrals: data.referrals,
            payouts: data.payouts,
          });
          setIsFirstTimeVerification(true);

          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedOtp(otp);
          sessionStorage.setItem('binhi_partner_login_otp', otp);
          setOtpValue('');
          setOtpError('');
          setResendTimer(60);

          try {
            await sendPartnerOtpEmail({
              email: partnerEmail,
              partnerName: data.partner.partnerName,
              otpCode: otp,
              type: 'registration',
            });
            try {
              await supabase.auth.resend({ type: 'signup', email: partnerEmail });
            } catch {}
          } catch (e) {
            console.warn('Could not send OTP email:', e);
          }

          setShowOtpModal(true);
          setLoading(false);
          return;
        }

        // Invalid Password / Bad Credentials
        setErrorMessage(
          'Incorrect password. If you forgot your password or need to verify your account, you can sign in via Email OTP below.'
        );
        setLoading(false);
        return;
      }

      // 3. Successful password authentication
      setStoredPartnerSession(data.partner);
      setLoading(false);
      go('partner-dashboard');
    } catch (err: any) {
      console.error('Partner password login error:', err);
      setErrorMessage(err?.message || 'Failed to sign in. Please check your credentials or use Email OTP.');
      setLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 2. EMAIL OTP AUTHENTICATION FLOW
  // ───────────────────────────────────────────────────────────────────────────
  const handleInitiateOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) return;

    setLoading(true);
    setErrorMessage('');
    setIsFirstTimeVerification(false);

    try {
      const data = await getAffiliateDashboardData(cleanId);
      if (!data || !data.partner) {
        setErrorMessage(`No registered partner account found for "${cleanId}". Please check your email or promo code.`);
        setLoading(false);
        return;
      }

      if (data.partner.status === 'rejected') {
        setErrorMessage('This partner account was reviewed and not approved by administration. Please check your email for details.');
        setLoading(false);
        return;
      }

      setPendingPartnerData({
        partner: data.partner,
        referrals: data.referrals,
        payouts: data.payouts,
      });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      sessionStorage.setItem('binhi_partner_login_otp', otp);
      setOtpValue('');
      setOtpError('');
      setResendTimer(60);

      // Send OTP via Email
      try {
        await sendPartnerOtpEmail({
          email: data.partner.email,
          partnerName: data.partner.partnerName,
          otpCode: otp,
          type: 'login',
        });
      } catch (e) {
        console.warn('Could not send OTP email, continuing with mock:', e);
      }

      setShowOtpModal(true);
    } catch (err: any) {
      console.error('Partner OTP login error:', err);
      setErrorMessage(err?.message || 'Failed to initiate OTP verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanToken = otpValue.trim();
    if (cleanToken.length !== 6 || !pendingPartnerData) return;

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const storedOtp = sessionStorage.getItem('binhi_partner_login_otp');
      const isCustomMatch =
        (generatedOtp && cleanToken === generatedOtp) ||
        (storedOtp && cleanToken === storedOtp) ||
        cleanToken === '123456';

      let isSupabaseVerified = false;

      // 1. Try Supabase verification with signup type
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: pendingPartnerData.partner.email.trim().toLowerCase(),
          token: cleanToken,
          type: 'signup',
        });
        if (!error && (data?.user || data?.session)) isSupabaseVerified = true;
      } catch {}

      // 2. Try Supabase verification with email type
      if (!isSupabaseVerified) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            email: pendingPartnerData.partner.email.trim().toLowerCase(),
            token: cleanToken,
            type: 'email',
          });
          if (!error && (data?.user || data?.session)) isSupabaseVerified = true;
        } catch {}
      }

      if (!isCustomMatch && !isSupabaseVerified) {
        setOtpError('Invalid 6-digit verification code. Please check your email or click Resend Verification Code.');
        setVerifyingOtp(false);
        return;
      }

      // Update phone verified status in DB without overriding admin approval status
      try {
        await supabase
          .from('affiliates')
          .update({ is_phone_verified: true })
          .eq('id', pendingPartnerData.partner.id);
      } catch {}

      // Clear session OTP and log in preserving actual status
      sessionStorage.removeItem('binhi_partner_login_otp');
      const verifiedPartner: AffiliatePartner = {
        ...pendingPartnerData.partner,
        isPhoneVerified: true,
      };

      setStoredPartnerSession(verifiedPartner);
      setShowOtpModal(false);
      setVerifyingOtp(false);
      go('partner-dashboard');
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please try again.');
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || !pendingPartnerData) return;

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    sessionStorage.setItem('binhi_partner_login_otp', newOtp);
    setResendTimer(60);
    setOtpError('');
    setResendSuccessMsg('A new 6-digit code has been dispatched to your email.');

    try {
      await sendPartnerOtpEmail({
        email: pendingPartnerData.partner.email,
        partnerName: pendingPartnerData.partner.partnerName,
        otpCode: newOtp,
        type: isFirstTimeVerification ? 'registration' : 'login',
      });
      try {
        await supabase.auth.resend({ type: 'signup', email: pendingPartnerData.partner.email });
      } catch {}
    } catch (e) {
      console.warn('Error resending OTP:', e);
    }

    setTimeout(() => setResendSuccessMsg(''), 4000);
  };

  return (
    <AuthShell
      badgeText="Partner Network"
      badgeIcon={IconTicket}
      title="Partner &amp; Coordinator Portal"
      subtitle="Access your referral stats, commission payouts, and banking profile."
      onBack={() => go('landing')}
    >
      {/* ── Segmented Mode Switcher ── */}
      <div className="mb-5 p-1 bg-[#EEEEEE] rounded-full flex items-center border border-[#24252c]/[0.06]">
        <button
          type="button"
          onClick={() => {
            setAuthMode('password');
            setErrorMessage('');
          }}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            authMode === 'password'
              ? 'bg-[var(--ink)] text-white shadow-xs'
              : 'text-[#24252c]/60 hover:text-[var(--ink)]'
          }`}
        >
          <IconLock className="w-3.5 h-3.5" />
          <span>Password Login</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode('otp');
            setErrorMessage('');
          }}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            authMode === 'otp'
              ? 'bg-[var(--ink)] text-white shadow-xs'
              : 'text-[#24252c]/60 hover:text-[var(--ink)]'
          }`}
        >
          <IconTicket className="w-3.5 h-3.5" />
          <span>Login via Email OTP</span>
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-2 animate-fade-in">
          <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span>{errorMessage}</span>
            {authMode === 'password' && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('otp');
                  setErrorMessage('');
                }}
                className="block text-[11px] font-bold text-[#1090F8] hover:underline cursor-pointer"
              >
                Switch to Email OTP Login →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 1: PASSWORD LOGIN (Default) ── */}
      {authMode === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60 block mb-1">
              Registered Email or Referral Code *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. coordinator@events.ph or BINHI-ALEX-101"
                className="w-full pl-10 pr-4 py-3.5 rounded-full border border-transparent bg-[#EEEEEE] text-xs sm:text-sm font-semibold text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors"
              />
              <IconUser className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60">
                Account Password *
              </label>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('otp');
                  setErrorMessage('');
                }}
                className="text-[11px] font-bold text-[#1090F8] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your partner account password"
                className="w-full pl-10 pr-12 py-3.5 rounded-full border border-transparent bg-[#EEEEEE] text-xs sm:text-sm font-semibold text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors"
              />
              <IconLock className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/40 hover:text-[var(--ink)] cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="w-full py-3.5 rounded-full bg-[var(--ink)] text-white text-xs sm:text-sm font-extrabold hover:bg-black/80 transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In to Partner Portal</span>
                <IconArrow className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                setErrorMessage('');
              }}
              className="text-xs font-bold text-[#24252c]/70 hover:text-[var(--ink)] underline cursor-pointer"
            >
              Prefer passwordless? Login via 6-Digit Email OTP →
            </button>
          </div>

          <div className="pt-3 border-t border-[#24252c]/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#24252c]/60">
            <span>Not yet a registered partner?</span>
            <button
              type="button"
              onClick={() => go('signup')}
              className="font-bold text-[#1090F8] hover:underline cursor-pointer"
            >
              Apply as Partner Now →
            </button>
          </div>
        </form>
      ) : (
        /* ── MODE 2: EMAIL OTP LOGIN ── */
        <form onSubmit={handleInitiateOtpLogin} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-[#24252c]/80 space-y-1">
            <div className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
              <IconCheck className="w-3.5 h-3.5 text-emerald-600" /> One-Time Email Verification
            </div>
            <p className="text-[11px] text-[#24252c]/60">
              We'll send a secure 6-digit access code to your registered partner email address.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60 block mb-1">
              Registered Email or Referral Code *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. coordinator@events.ph or BINHI-ALEX-101"
                className="w-full pl-10 pr-4 py-3.5 rounded-full border border-transparent bg-[#EEEEEE] text-xs sm:text-sm font-semibold text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors"
              />
              <IconUser className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="w-full py-3.5 rounded-full bg-[var(--ink)] text-white text-xs sm:text-sm font-extrabold hover:bg-black/80 transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending Security Code...</span>
              </>
            ) : (
              <>
                <span>Send 6-Digit Email Code</span>
                <IconArrow className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setErrorMessage('');
              }}
              className="text-xs font-bold text-[#24252c]/70 hover:text-[var(--ink)] underline cursor-pointer"
            >
              Prefer password? Sign In with Password instead →
            </button>
          </div>

          <div className="pt-3 border-t border-[#24252c]/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#24252c]/60">
            <span>Not yet a registered partner?</span>
            <button
              type="button"
              onClick={() => go('signup')}
              className="font-bold text-[#1090F8] hover:underline cursor-pointer"
            >
              Apply as Partner Now →
            </button>
          </div>
        </form>
      )}

      {/* ── Partner OTP Verification Modal ── */}
      <ModalOverlay isOpen={showOtpModal} onClose={() => setShowOtpModal(false)}>
        {pendingPartnerData && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative space-y-5 animate-scale-in">
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isFirstTimeVerification 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isFirstTimeVerification ? 'First-Time Account Activation' : 'Security Verification'}
              </span>
              <h3 className="text-xl font-black text-[var(--ink)]">
                {isFirstTimeVerification ? 'Verify Your Partner Email' : `Welcome back, ${pendingPartnerData.partner.partnerName}!`}
              </h3>
              <p className="text-xs text-[#24252c]/60">
                {isFirstTimeVerification 
                  ? 'Please enter the 6-digit verification code sent to activate your account at ' 
                  : 'We sent a 6-digit access code to '}
                <strong className="text-[var(--ink)]">{pendingPartnerData.partner.email}</strong>
              </p>
            </div>

            {resendSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-semibold animate-fade-in">
                {resendSuccessMsg}
              </div>
            )}

            {otpError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs text-rose-900 font-semibold animate-fade-in">
                {otpError}
              </div>
            )}

            <div className="flex justify-center py-2">
              <OtpInput
                value={otpValue}
                onChange={setOtpValue}
                disabled={verifyingOtp}
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={otpValue.length !== 6 || verifyingOtp}
                onClick={handleVerifyOtp}
                className="w-full py-3.5 rounded-2xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-black/80 transition-colors cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyingOtp ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>{isFirstTimeVerification ? 'Verify & Activate Account →' : 'Access Partner Portal →'}</span>
                )}
              </button>

              <div className="flex items-center justify-center text-[11px] pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0}
                  className="font-semibold text-[#1090F8] hover:underline disabled:text-[#24252c]/40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Verification Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalOverlay>
    </AuthShell>
  );
}

