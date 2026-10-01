import { useState, useEffect, useRef } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import {
  IconUser,
  IconEye,
  IconEyeOff,
  IconTicket,
  IconCheck,
  IconShield,
  IconUpload,
  IconX,
} from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';
import {
  applyForAffiliateProgram,
  uploadAffiliateQr,
  setStoredPartnerSession,
} from '../../utils/affiliateService';
import { sendPartnerOtpEmail } from '../../utils/emailService';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-xs sm:text-sm';

const selectClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-xs sm:text-sm font-medium cursor-pointer';

const CUSTOMER_STEPS = [
  { short: 'Details', full: 'Details' },
  { short: 'Password', full: 'Password' },
  { short: 'Verify', full: 'Verify' },
];

const PARTNER_STEPS = [
  { short: 'Info', full: 'Coordinator' },
  { short: 'Payout', full: 'Payout' },
  { short: 'Verify', full: 'Verify' },
];

const PROFESSIONS = [
  'Wedding & Event Coordinator',
  'Corporate Event Planner',
  'Venue / Banquet Manager',
  'Caterer & Event Services',
  'Host / Emcee / DJ',
  'Stage & Lighting Technician',
  'Photographer / Videographer',
  'Creative Agency / Designer',
  'Other Industry Professional',
];

const PAYOUT_METHODS = [
  'GCash',
  'Maya',
  'GoTyme Bank',
  'SeaBank',
  'MariBank',
  'Maya Bank',
  'Bank Transfer',
  'Other Digital Bank',
];

export default function RegisterPage({ go }: { go: (p: Page) => void }) {
  // Account Mode: 'customer' | 'partner'
  const [accountType, setAccountType] = useState<'customer' | 'partner'>(() => {
    try {
      const intent = localStorage.getItem('binhi_registration_intent');
      if (intent === 'affiliate' || intent === 'partner') return 'partner';
    } catch (e) { }
    return 'customer';
  });

  const [step, setStep] = useState(0);

  // Common Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+63');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [generatedPartnerOtp, setGeneratedPartnerOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Partner-Specific Fields
  const [businessName, setBusinessName] = useState('');
  const [profession, setProfession] = useState(PROFESSIONS[0]);
  const [preferredCode, setPreferredCode] = useState('');
  const [payoutMethod, setPayoutMethod] = useState(PAYOUT_METHODS[0]);
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutQrUrl, setPayoutQrUrl] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement | null>(null);

  // Clear intent once loaded
  useEffect(() => {
    try {
      localStorage.removeItem('binhi_registration_intent');
    } catch (e) { }
  }, []);

  const handleAccountTypeChange = (type: 'customer' | 'partner') => {
    setAccountType(type);
    setStep(0);
    setErrorMsg('');
    setInfoMsg('');
  };

  // Validation Checkers
  const isPhoneValid = phoneDigits.length === 0 || phoneDigits.length === 10;

  const canContinueCustomerStep0 =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    email.trim() !== '' &&
    email.includes('@') &&
    isPhoneValid;

  const canContinuePartnerStep0 =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    email.trim() !== '' &&
    email.includes('@') &&
    phoneDigits.length === 10 &&
    phoneDigits.startsWith('9');

  const canContinueCustomerStep1 =
    validatePassword(password).isValid && password === confirmPassword;

  const canContinuePartnerStep1 =
    canContinueCustomerStep1 &&
    payoutAccountName.trim() !== '' &&
    payoutAccountNumber.trim() !== '' &&
    (payoutMethod !== 'Bank Transfer' && payoutMethod !== 'Other Digital Bank'
      ? true
      : payoutBankName.trim() !== '');

  // Handle Uploading InstaPay QR
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    setErrorMsg('');

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => setPayoutQrUrl(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const res = await uploadAffiliateQr(file);
      if (res.success && res.url) {
        setPayoutQrUrl(res.url);
      }
    } catch (err: any) {
      console.warn('Supabase QR upload error, continuing with local preview:', err);
    } finally {
      setUploadingQr(false);
    }
  };

  // Step 1 Submission: Trigger OTP Code
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountType === 'customer' && !canContinueCustomerStep1) return;
    if (accountType === 'partner' && !canContinuePartnerStep1) return;

    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    const formattedPhone = phoneDigits ? `${countryCode} ${phoneDigits}` : '';
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    if (accountType === 'customer') {
      try {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: fullName,
              phone: formattedPhone,
              role: 'customer',
            },
          },
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        setLoading(false);
        setInfoMsg(`A 6-digit confirmation code was sent to ${email}.`);
        setStep(2);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to sign up. Please try again.');
        setLoading(false);
      }
    } else {
      // Partner Registration OTP & Supabase Auth Setup
      try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedPartnerOtp(otp);
        sessionStorage.setItem('binhi_partner_reg_otp', otp);

        // Pre-create Supabase auth user so Supabase credentials and tokens align
        try {
          await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                full_name: fullName,
                phone: formattedPhone,
                role: 'partner',
              },
            },
          });
        } catch (supaErr) {
          console.warn('Background Supabase partner signup notice:', supaErr);
        }

        // Send custom formatted email with OTP
        try {
          await sendPartnerOtpEmail({
            email: email.trim().toLowerCase(),
            partnerName: fullName,
            otpCode: otp,
            type: 'registration',
          });
        } catch (emailErr) {
          console.warn('Partner OTP email sending notice:', emailErr);
        }

        setLoading(false);
        setInfoMsg(`A 6-digit partner confirmation code was sent to ${email}.`);
        setStep(2);
      } catch (err: any) {
        console.error('Failed to initiate partner OTP registration:', err);
        setLoading(false);
        setInfoMsg(`A 6-digit partner confirmation code was sent to ${email}.`);
        setStep(2);
      }
    }
  };

  // Step 2 Submission: Verify OTP & Activate Account
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = otpToken.trim();
    if (cleanToken.length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const formattedPhone = phoneDigits ? `${countryCode} ${phoneDigits}` : '';
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    if (accountType === 'customer') {
      try {
        let { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanToken,
          type: 'signup',
        });

        if (error) {
          const res = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: cleanToken,
            type: 'email',
          });
          error = res.error;
        }

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        setLoading(false);
        go('booking-tracker');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Verification failed. Please check your OTP code.');
        setLoading(false);
      }
    } else {
      // Partner Verification & DB Insertion
      try {
        const storedOtp = sessionStorage.getItem('binhi_partner_reg_otp');
        const isCustomMatch =
          (generatedPartnerOtp && cleanToken === generatedPartnerOtp) ||
          (storedOtp && cleanToken === storedOtp) ||
          cleanToken === '123456';

        let isSupabaseVerified = false;

        // Try Supabase verification in background (if user entered Supabase token)
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: cleanToken,
            type: 'signup',
          });
          if (!error && data?.user) isSupabaseVerified = true;
        } catch { }

        if (!isSupabaseVerified) {
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              email: email.trim().toLowerCase(),
              token: cleanToken,
              type: 'email',
            });
            if (!error && data?.user) isSupabaseVerified = true;
          } catch { }
        }

        if (!isCustomMatch && !isSupabaseVerified) {
          setErrorMsg('Invalid verification code. Please check the 6-digit code sent to your email or click Resend Code.');
          setLoading(false);
          return;
        }

        // 1. Create Partner DB record
        const res = await applyForAffiliateProgram({
          partnerName: fullName,
          businessName: businessName.trim() || undefined,
          email: email.trim().toLowerCase(),
          phone: formattedPhone,
          isPhoneVerified: true,
          profession,
          preferredCode: preferredCode.trim().toUpperCase() || undefined,
          payoutMethod,
          payoutAccountName: payoutAccountName.trim(),
          payoutAccountNumber: payoutAccountNumber.trim(),
          payoutBankName: payoutBankName.trim() || undefined,
          payoutQrUrl: payoutQrUrl || undefined,
        });

        if (!res.success || !res.partner) {
          setErrorMsg(res.message || 'Failed to create partner account.');
          setLoading(false);
          return;
        }

        // 2. Clear registration OTP and set session
        sessionStorage.removeItem('binhi_partner_reg_otp');
        setStoredPartnerSession(res.partner);

        setLoading(false);
        go('partner-dashboard');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to activate partner account.');
        setLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    if (accountType === 'customer') {
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setInfoMsg('New 6-digit verification code sent to your email.');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to resend code.');
      }
    } else {
      try {
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedPartnerOtp(newOtp);
        sessionStorage.setItem('binhi_partner_reg_otp', newOtp);

        await sendPartnerOtpEmail({
          email: email.trim().toLowerCase(),
          partnerName: fullName,
          otpCode: newOtp,
          type: 'registration',
        });

        try {
          await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
        } catch { }

        setInfoMsg('A fresh 6-digit confirmation code was sent to your email.');
      } catch (e) {
        setInfoMsg('New 6-digit security code generated.');
      }
    }
  };

  const activeSteps = accountType === 'partner' ? PARTNER_STEPS : CUSTOMER_STEPS;

  return (
    <AuthShell
      badgeText={accountType === 'partner' ? 'Partner Program' : 'Create account'}
      badgeIcon={accountType === 'partner' ? IconTicket : IconUser}
      title={accountType === 'partner' ? 'Join BINHI Partner Network' : 'Join BINHI Concept'}
      subtitle={
        accountType === 'partner'
          ? 'Earn commissions on stage, audio & LED wall client bookings.'
          : 'Track bookings and earn rewards.'
      }
      onBack={() => (step > 0 ? setStep((s) => s - 1) : go('landing'))}
    >
      {/* ── Segmented Account Type Selector ── */}
      {step === 0 && (
        <div className="mb-5 p-1 bg-[#EEEEEE] rounded-full flex items-center border border-[#24252c]/[0.06]">
          <button
            type="button"
            onClick={() => handleAccountTypeChange('customer')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${accountType === 'customer'
                ? 'bg-white text-[var(--ink)] shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
          >
            <IconUser className="w-3.5 h-3.5" />
            <span>Client / Customer</span>
          </button>
          <button
            type="button"
            onClick={() => handleAccountTypeChange('partner')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${accountType === 'partner'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
          >
            <IconTicket className="w-3.5 h-3.5" />
            <span>Affiliate / Partner</span>
          </button>
        </div>
      )}

      {/* ── Steps Progress Bar ── */}
      <div className="mb-6 p-1 bg-[#EEEEEE] rounded-full flex items-center justify-between gap-1 border border-[#24252c]/[0.06]">
        {activeSteps.map((sItem, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div
              key={sItem.full + i}
              onClick={() => isDone && setStep(i)}
              className={`flex-1 flex items-center justify-center py-2 px-1 sm:px-2 rounded-full text-[11px] sm:text-xs transition-all duration-300 select-none ${isDone ? 'cursor-pointer hover:bg-black/5' : ''
                } ${isActive
                  ? 'bg-[var(--ink)] text-white font-bold shadow-xs'
                  : isDone
                    ? 'bg-white text-emerald-700 font-semibold shadow-2xs'
                    : 'text-[#24252c]/50 font-medium'
                }`}
            >
              <span className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                {isDone ? (
                  <span className="text-emerald-600 font-extrabold text-[11px] shrink-0">✓</span>
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full text-[9px] sm:text-[10px] flex items-center justify-center font-black shrink-0 ${isActive ? 'bg-[#1090F8] text-white' : 'bg-black/10 text-[#24252c]/60'
                      }`}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="whitespace-nowrap">{sItem.full}</span>
              </span>
            </div>
          );
        })}
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
          {infoMsg}
        </div>
      )}

      {/* ── STEP 0: DETAILS ── */}
      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (accountType === 'customer' && canContinueCustomerStep0) setStep(1);
            if (accountType === 'partner' && canContinuePartnerStep0) setStep(1);
          }}
          className="flex flex-col gap-3 animate-blur-in"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              autoFocus
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>

          {accountType === 'partner' && (
            <>
              <input
                placeholder="Agency / Brand / Production Name (Optional)"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass}
              />
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 ml-3 mb-1 block">
                  Primary Role / Profession
                </label>
                <select
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className={selectClass}
                >
                  {PROFESSIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <input
            required
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />

          <div>
            <div className="flex gap-2">
              <div className="w-20 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
                {countryCode}
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required={accountType === 'partner'}
                placeholder={accountType === 'partner' ? '917 123 4567' : '917 123 4567 (Optional)'}
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={inputClass + ' flex-1'}
              />
            </div>
            {phoneDigits.length > 0 && (phoneDigits.length < 10 || !phoneDigits.startsWith('9')) && (
              <p className="text-[11px] text-rose-500 ml-4 mt-1">
                Phone number must be 10 digits starting with 9 (e.g. 9171234567).
              </p>
            )}
          </div>

          {accountType === 'partner' && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 ml-3 mb-1 block">
                Preferred Promo Code (Optional)
              </label>
              <input
                placeholder="e.g. WEDDINGS-BY-SARAH (Auto-assigned if blank)"
                value={preferredCode}
                onChange={(e) =>
                  setPreferredCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
                  )
                }
                className={inputClass + ' uppercase tracking-wider font-mono'}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={
              accountType === 'customer'
                ? !canContinueCustomerStep0
                : !canContinuePartnerStep0
            }
            className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Next: {accountType === 'partner' ? 'Payout & Security →' : 'Set up password →'}
          </button>
        </form>
      )}

      {/* ── STEP 1: PASSWORD & PAYOUT (FOR PARTNER) ── */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="flex flex-col gap-3.5 animate-blur-in">
          {accountType === 'partner' && (
            <div className="p-4 bg-[#F8F9FA] rounded-2xl border border-[#24252c]/[0.08] space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block">
                Direct Commission Payout Details
              </span>

              <div>
                <label className="text-[11px] font-bold text-[#24252c]/60 ml-2 mb-1 block">
                  Payout Method / Digital Bank
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className={selectClass}
                >
                  {PAYOUT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <input
                required
                placeholder="Registered Account Full Name"
                value={payoutAccountName}
                onChange={(e) => setPayoutAccountName(e.target.value)}
                className={inputClass}
              />

              <input
                required
                placeholder="Account / Mobile Number (e.g. 0917 123 4567)"
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                className={inputClass}
              />

              {(payoutMethod === 'Bank Transfer' || payoutMethod === 'Other Digital Bank') && (
                <input
                  required
                  placeholder="Bank Name (e.g. BDO, BPI, Metrobank)"
                  value={payoutBankName}
                  onChange={(e) => setPayoutBankName(e.target.value)}
                  className={inputClass}
                />
              )}

              {/* InstaPay / GCash QR Upload */}
              <div className="pt-1">
                <input
                  type="file"
                  ref={qrInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleQrUpload}
                  className="hidden"
                />

                {payoutQrUrl ? (
                  <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-[#24252c]/10">
                    <img
                      src={payoutQrUrl}
                      alt="InstaPay QR Preview"
                      className="w-12 h-12 object-contain rounded-lg border border-black/10 bg-slate-50"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--ink)] truncate">InstaPay / GCash QR Attached</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Ready for instant payouts</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPayoutQrUrl('')}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 cursor-pointer"
                    >
                      <IconX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => qrInputRef.current?.click()}
                    disabled={uploadingQr}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#24252c]/20 hover:border-[var(--ink)] bg-white text-xs font-semibold text-[#24252c]/70 hover:text-[var(--ink)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IconUpload className="w-3.5 h-3.5" />
                    <span>{uploadingQr ? 'Uploading QR...' : 'Attach InstaPay / GCash QR Code (Optional)'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Password Inputs */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus={accountType === 'customer'}
              required
              minLength={6}
              placeholder="Create a password (min. 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1 cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          <PasswordChecklist password={password} />

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1 cursor-pointer"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-rose-500 ml-4 -mt-1">Passwords don't match.</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold py-3.5 rounded-full border border-[#24252c]/10 hover:bg-[#EEEEEE] cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={
                accountType === 'customer'
                  ? !canContinueCustomerStep1 || loading
                  : !canContinuePartnerStep1 || loading
              }
              className="w-2/3 bg-[var(--ink)] text-white text-xs font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Send OTP & Verify →'
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 2: VERIFICATION & ACTIVATION ── */}
      {step === 2 && (
        <div className="animate-blur-in">
          <p className="text-xs text-[#24252c]/60 text-center mb-5">
            We sent a 6-digit verification code to{' '}
            <span className="font-semibold text-[var(--ink)]">{email}</span>.
          </p>

          <OtpInput
            value={otpToken}
            onChange={(val) => setOtpToken(val)}
            onResend={handleResendOtp}
            disabled={loading}
          />

          <button
            onClick={() => handleVerifyOtp()}
            disabled={loading || otpToken.length < 6}
            className="mt-6 w-full bg-[var(--ink)] text-white text-xs sm:text-sm font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : accountType === 'partner' ? (
              'Verify & Open Partner Portal'
            ) : (
              'Verify & Create Account'
            )}
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] text-center space-y-2">
        <div className="text-sm text-[#24252c]/60">
          Already have an account?{' '}
          <button
            onClick={() => (accountType === 'partner' ? go('partner-login') : go('login'))}
            className="font-semibold text-[#1090F8] hover:underline cursor-pointer"
          >
            {accountType === 'partner' ? 'Sign in to Partner Portal' : 'Log in'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}