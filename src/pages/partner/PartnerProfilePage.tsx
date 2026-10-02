import { useState, useEffect, useRef } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconUser,
  IconCheck,
  IconX,
  IconExternal,
  IconEye,
  IconShield,
  IconAlertTriangle,
  IconUpload,
  IconTicket,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { OtpInput } from '../../components/shared/OtpInput';
import { sendOtp, verifyOtp } from '../../utils/smsService';
import {
  getStoredPartnerSession,
  setStoredPartnerSession,
  updateAffiliateProfile,
  uploadAffiliateQr,
  type AffiliatePartner,
} from '../../utils/affiliateService';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-xs sm:text-sm font-medium';

const selectClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-xs sm:text-sm font-medium cursor-pointer';

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

export default function PartnerProfilePage({ go }: { go: (p: Page) => void }) {
  const [partner, setPartner] = useState<AffiliatePartner | null>(() => getStoredPartnerSession());

  // Form Fields
  const [partnerName, setPartnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode] = useState('+63');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [savedPhoneDigits, setSavedPhoneDigits] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(true);
  const [profession, setProfession] = useState(PROFESSIONS[0]);

  // Banking & Payout Fields
  const [payoutMethod, setPayoutMethod] = useState<string>(PAYOUT_METHODS[0]);
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutQrUrl, setPayoutQrUrl] = useState<string>('');

  // Phone Verification Modal State (PhilSMS OTP)
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneOtpToken, setPhoneOtpToken] = useState('');
  const [phoneHmacToken, setPhoneHmacToken] = useState('');
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneModalError, setPhoneModalError] = useState('');
  const [phoneModalInfo, setPhoneModalInfo] = useState('');

  // File Upload State for InstaPay QR
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status & Feedback
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Enlarged QR Lightbox Modal
  const [enlargedQr, setEnlargedQr] = useState<string | null>(null);

  // Helper to extract clean 10-digit number
  const parseDigits = (raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.startsWith('63') && clean.length >= 12) {
      return clean.slice(2, 12);
    }
    if (clean.length > 10) {
      return clean.slice(-10);
    }
    return clean;
  };

  useEffect(() => {
    const session = getStoredPartnerSession();
    if (!session) {
      go('partner-login');
      return;
    }
    setPartner(session);
    setPartnerName(session.partnerName || '');
    setBusinessName(session.businessName || '');
    setEmail(session.email || '');
    const digits = parseDigits(session.phone || '');
    setPhoneDigits(digits);
    setSavedPhoneDigits(digits);
    setIsPhoneVerified(session.isPhoneVerified !== false);
    setProfession(session.profession || PROFESSIONS[0]);
    setPayoutMethod(session.payoutMethod || PAYOUT_METHODS[0]);
    setPayoutAccountName(session.payoutAccountName || '');
    setPayoutAccountNumber(session.payoutAccountNumber || '');
    setPayoutBankName(session.payoutBankName || '');
    setPayoutQrUrl(session.payoutQrUrl || '');
    setQrPreview(session.payoutQrUrl || null);
  }, [go]);

  const isPhoneValid = phoneDigits.length === 10 && phoneDigits.startsWith('9');

  // ── Phone Verification Handlers (PhilSMS OTP via Supabase Edge Function) ──
  const handleStartPhoneVerification = async () => {
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
      setErrorMessage('Please enter a valid 10-digit mobile number starting with 9 first (e.g. 9171234567).');
      return;
    }

    setErrorMessage(null);
    setPhoneModalError('');
    setPhoneModalInfo('');
    setPhoneOtpToken('');
    setShowPhoneModal(true);
    setSendingPhoneOtp(true);

    try {
      const fullPhone = `${countryCode}${phoneDigits}`;
      const res = await sendOtp(fullPhone, 'partner_phone_verification');

      if (res.success && res.token) {
        setPhoneHmacToken(res.token);
        if (res.simulated) {
          setPhoneModalInfo(
            `Simulated OTP Mode: Use verification code ${res.simulatedCode || '123456'} (or check edge function logs).`
          );
        } else {
          setPhoneModalInfo(`A 6-digit verification code has been dispatched via SMS to +63 ${phoneDigits}.`);
        }
      } else {
        setPhoneModalError(res.error || 'Failed to dispatch verification SMS. Please try again.');
      }
    } catch (err: any) {
      console.error('[PartnerProfilePage] Error sending phone OTP:', err);
      setPhoneModalError(err?.message || 'Network error sending verification code.');
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) return;

    setPhoneModalError('');
    setPhoneOtpToken('');
    setSendingPhoneOtp(true);

    try {
      const fullPhone = `${countryCode}${phoneDigits}`;
      const res = await sendOtp(fullPhone, 'partner_phone_verification');

      if (res.success && res.token) {
        setPhoneHmacToken(res.token);
        if (res.simulated) {
          setPhoneModalInfo(
            `Simulated OTP Mode: Use new verification code ${res.simulatedCode || '123456'}.`
          );
        } else {
          setPhoneModalInfo('A new verification code has been sent to your phone via SMS!');
        }
      } else {
        setPhoneModalError(res.error || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      setPhoneModalError(err?.message || 'Error resending code.');
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleConfirmPhoneVerification = async () => {
    if (phoneOtpToken.trim().length !== 6) {
      setPhoneModalError('Please enter the full 6-digit verification code.');
      return;
    }

    if (!phoneHmacToken) {
      setPhoneModalError('Verification session expired. Please request a new code.');
      return;
    }

    setVerifyingPhone(true);
    setPhoneModalError('');

    const formattedPhone = `${countryCode} ${phoneDigits}`;
    const fullPhone = `${countryCode}${phoneDigits}`;

    try {
      const res = await verifyOtp(fullPhone, phoneOtpToken.trim(), phoneHmacToken);

      if (!res.valid) {
        setPhoneModalError(res.error || 'Incorrect or expired verification code. Please try again.');
        setVerifyingPhone(false);
        return;
      }

      // Validated! Persist to Partner Profile & Session
      setIsPhoneVerified(true);
      setIsEditingPhone(false);
      setSavedPhoneDigits(phoneDigits);
      setShowPhoneModal(false);
      setPhoneOtpToken('');
      setPhoneHmacToken('');

      if (partner?.id) {
        const updateRes = await updateAffiliateProfile({
          partnerId: partner.id,
          phone: formattedPhone,
          isPhoneVerified: true,
        });
        if (updateRes.partner) {
          setPartner(updateRes.partner);
        }
      }

      setSuccessMessage('Mobile phone number verified successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('[PartnerProfilePage] Error verifying phone OTP:', err);
      setPhoneModalError(err?.message || 'Failed to verify OTP.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  // QR Upload Handler
  const handleQrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('QR image size must be under 5MB.');
      return;
    }

    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
    setErrorMessage(null);

    setUploadingQr(true);
    try {
      const uploadRes = await uploadAffiliateQr(file);
      if (uploadRes.success && uploadRes.url) {
        setPayoutQrUrl(uploadRes.url);
        setQrPreview(uploadRes.url);
      }
    } catch (err: any) {
      console.warn('QR storage upload note:', err);
    } finally {
      setUploadingQr(false);
    }
  };

  const handleRemoveQr = () => {
    setQrFile(null);
    setQrPreview(null);
    setPayoutQrUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save All Profile & Payout Information
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    if (!isPhoneValid) {
      setErrorMessage('Mobile phone number must be a valid 10-digit number starting with 9 (e.g. 9171234567).');
      return;
    }

    if (!payoutAccountName.trim()) {
      setErrorMessage('Please enter the registered payout account name.');
      return;
    }

    if (!payoutAccountNumber.trim()) {
      setErrorMessage('Please enter the payout account / mobile number.');
      return;
    }

    if ((payoutMethod === 'Bank Transfer' || payoutMethod === 'Other Digital Bank') && !payoutBankName.trim()) {
      setErrorMessage('Please specify the receiving bank name.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let finalQrUrl = payoutQrUrl;

      if (qrFile && !payoutQrUrl.startsWith('http')) {
        const uploadRes = await uploadAffiliateQr(qrFile);
        if (uploadRes.success && uploadRes.url) {
          finalQrUrl = uploadRes.url;
        }
      } else if (!qrPreview) {
        finalQrUrl = '';
      }

      const formattedPhone = `${countryCode} ${phoneDigits}`;
      const finalVerified = isEditingPhone && phoneDigits !== savedPhoneDigits ? false : isPhoneVerified;

      const res = await updateAffiliateProfile({
        partnerId: partner.id,
        partnerName: partnerName.trim(),
        businessName: businessName.trim() || undefined,
        phone: formattedPhone,
        isPhoneVerified: finalVerified,
        profession: profession.trim(),
        payoutMethod,
        payoutAccountName: payoutAccountName.trim(),
        payoutAccountNumber: payoutAccountNumber.trim(),
        payoutBankName: payoutMethod === 'Bank Transfer' || payoutMethod === 'Other Digital Bank' ? payoutBankName.trim() : undefined,
        payoutQrUrl: finalQrUrl || undefined,
      });

      if (res.success && res.partner) {
        setPartner(res.partner);
        setStoredPartnerSession(res.partner);
        setSavedPhoneDigits(phoneDigits);
        setIsEditingPhone(false);
        setIsPhoneVerified(finalVerified);
        setPayoutQrUrl(res.partner.payoutQrUrl || '');
        setQrPreview(res.partner.payoutQrUrl || null);
        setQrFile(null);
        setSuccessMessage('Your partner profile and payout banking details have been updated successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.message || 'Failed to update profile.');
      }
    } catch (err: any) {
      console.error('Error updating partner profile:', err);
      setErrorMessage(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!partner) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* ── Page Header & Status Card ── */}
      <div className="border-b border-[#24252c]/[0.06] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <MonoBadge icon={IconShield}>Partner Account Settings</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
            Partner Profile &amp; Payout Settings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Manage your coordinator identity, contact details, mobile verification, and direct commission banking profile.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{partner.commissionRate}% Direct Commission</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#1090F8] text-xs font-mono font-bold shadow-2xs">
            Code: {partner.referralCode}
          </div>
        </div>
      </div>

      {/* ── Feedback Messages ── */}
      {errorMessage && (
        <div className="p-4 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2.5 animate-fadeIn">
          <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium flex items-center gap-2.5 animate-fadeIn">
          <IconCheck className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Card 1: Partner Identity & Contact Info ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/[0.06]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <IconUser className="w-4 h-4 text-[#1090F8]" />
                Personal &amp; Coordinator Identity
              </h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                Your public coordinator name and verified communication channels.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Full Name / Coordinator Name *
              </label>
              <input
                required
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="e.g. Maria Clara Santos"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Agency / Brand / Production Name
              </label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. MCS Weddings &amp; Events Management"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Primary Event Profession / Role *
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

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Registered Email Address
              </label>
              <input
                type="email"
                disabled
                value={email}
                className={inputClass + ' opacity-60 cursor-not-allowed'}
              />
            </div>
          </div>

          {/* Mobile Phone Number with Separate +63 and Verification Modal */}
          <div>
            <div className="flex items-center justify-between ml-1 mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                Mobile Phone Number *
              </label>
              {isPhoneVerified ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    Verified {isEditingPhone && <span className="text-[9px] text-amber-600 font-semibold">(Editing)</span>}
                  </span>
                  {isEditingPhone ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPhone(false);
                        setPhoneDigits(savedPhoneDigits);
                      }}
                      className="text-[10px] font-bold text-[#24252c]/60 hover:text-[var(--ink)] bg-[#EEEEEE] hover:bg-[#E0E0E0] px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPhone(true);
                        setSuccessMessage('Phone unlocked. Update your number below and click "Save Profile & Payout Details".');
                        setTimeout(() => setSuccessMessage(null), 4000);
                      }}
                      className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 hover:bg-[#1090F8]/20 border border-[#1090F8]/20 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      Edit Phone
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartPhoneVerification}
                  disabled={sendingPhoneOtp}
                  className="group relative text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-300 hover:border-rose-400 px-3 py-1 rounded-full transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-sm"
                  title="Click to verify this mobile number via SMS OTP"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span>Unverified</span>
                  <span className="font-semibold text-rose-700 bg-rose-200/70 group-hover:bg-rose-200 px-1.5 py-0.5 rounded-full text-[9px] transition-colors flex items-center gap-0.5">
                    {sendingPhoneOtp ? 'Sending...' : 'Click to verify ↗'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="w-20 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
                {countryCode}
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phoneDigits}
                readOnly={isPhoneVerified && !isEditingPhone}
                onChange={(e) => {
                  setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setErrorMessage(null);
                }}
                placeholder="917 123 4567"
                className={inputClass + ` flex-1 ${isPhoneVerified && !isEditingPhone ? 'cursor-not-allowed opacity-90' : ''}`}
              />
            </div>

            {phoneDigits.length > 0 && !isPhoneValid && (
              <p className="text-[11px] text-rose-500 ml-4 mt-1">
                Mobile number must be exactly 10 digits starting with 9 (e.g. 9171234567).
              </p>
            )}
          </div>
        </div>

        {/* ── Card 2: Direct Commission Payout & Banking Profile ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/[0.06]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <IconTicket className="w-4 h-4 text-emerald-600" />
                Direct Commission Payout &amp; Banking Details
              </h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                Where BINHI Concept automatically disburses your event commission payouts.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Instant GCash &amp; Bank Transfer
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Payout Method / Digital Bank *
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

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Registered Account Full Name *
              </label>
              <input
                required
                value={payoutAccountName}
                onChange={(e) => setPayoutAccountName(e.target.value)}
                placeholder="e.g. Maria Clara Santos"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Account / Mobile Number *
              </label>
              <input
                required
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                placeholder="e.g. 0917 123 4567 or 1234-5678-90"
                className={inputClass}
              />
            </div>

            {(payoutMethod === 'Bank Transfer' || payoutMethod === 'Other Digital Bank') && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Bank Institution Name *
                </label>
                <input
                  required
                  value={payoutBankName}
                  onChange={(e) => setPayoutBankName(e.target.value)}
                  placeholder="e.g. BDO, BPI, UnionBank, Metrobank"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* InstaPay / GCash QR Upload with Lightbox Preview */}
          <div className="pt-2 border-t border-[#24252c]/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1">
                InstaPay / GCash QR Code Image (Optional)
              </label>
              <span className="text-[10px] text-[#24252c]/40 font-medium">
                Enables 1-click scan disbursement for admins
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleQrFileSelect}
              className="hidden"
            />

            {qrPreview ? (
              <div className="p-4 bg-[var(--mist)] rounded-2xl border border-[#24252c]/10 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setEnlargedQr(qrPreview)}
                    className="relative group w-14 h-14 rounded-xl overflow-hidden border border-black/10 bg-white cursor-pointer shrink-0 shadow-2xs"
                    title="Click to enlarge QR"
                  >
                    <img
                      src={qrPreview}
                      alt="InstaPay QR Preview"
                      className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <IconEye className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--ink)]">InstaPay / GCash QR Attached</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Ready for instant commission payouts</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEnlargedQr(qrPreview)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#24252c]/10 text-xs font-semibold text-[var(--ink)] hover:bg-black/5 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <IconEye className="w-3.5 h-3.5" />
                    <span>View QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveQr}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingQr}
                className="w-full py-4 px-4 rounded-2xl border border-dashed border-[#24252c]/20 hover:border-[var(--ink)] bg-[#FAFAFA] text-xs font-semibold text-[#24252c]/70 hover:text-[var(--ink)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <IconUpload className="w-4 h-4" />
                <span>{uploadingQr ? 'Uploading QR...' : 'Click to Upload InstaPay or GCash QR Code Image'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Submit Action Button ── */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || !isPhoneValid}
            className="bg-[var(--ink)] text-white text-xs font-semibold px-8 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Profile &amp; Payout Details</span>
            )}
          </button>
        </div>
      </form>

      {/* ── Mobile Phone OTP Verification Modal (PhilSMS OTP via Supabase Edge Function) ── */}
      <ModalOverlay isOpen={showPhoneModal} onClose={() => setShowPhoneModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            type="button"
            onClick={() => setShowPhoneModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <span className="w-12 h-12 rounded-full bg-[#1090F8]/10 text-[#1090F8] font-bold text-lg flex items-center justify-center mx-auto mb-3">
              <IconShield className="w-6 h-6" />
            </span>
            <h3 className="text-2xl font-extrabold text-[var(--ink)]">Verify Mobile Number</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              We sent a 6-digit verification code via SMS to{' '}
              <strong className="text-[var(--ink)]">+63 {phoneDigits}</strong>.
            </p>
          </div>

          {phoneModalInfo && (
            <div className="mb-4 p-3 rounded-xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-left">
              {phoneModalInfo}
            </div>
          )}

          {phoneModalError && (
            <div className="mb-4 p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium text-left">
              {phoneModalError}
            </div>
          )}

          <div className="my-6">
            <OtpInput
              value={phoneOtpToken}
              onChange={(val) => setPhoneOtpToken(val)}
              onResend={handleResendPhoneOtp}
              disabled={verifyingPhone || sendingPhoneOtp}
            />
          </div>

          <button
            type="button"
            onClick={handleConfirmPhoneVerification}
            disabled={verifyingPhone || phoneOtpToken.length < 6 || !phoneHmacToken}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifyingPhone ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Confirm & Verify Phone Number'
            )}
          </button>
        </div>
      </ModalOverlay>

      {/* ── Enlarged QR Code Lightbox Modal ── */}
      <ModalOverlay isOpen={!!enlargedQr} onClose={() => setEnlargedQr(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 text-center">
          <button
            type="button"
            onClick={() => setEnlargedQr(null)}
            className="absolute top-6 right-6 text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase inline-block">
              InstaPay / GCash QR
            </span>
            <h4 className="font-extrabold text-xl tracking-tight text-[var(--ink)] mt-2">Payout QR Code</h4>
            <p className="text-xs text-[#24252c]/60 mt-0.5">{partner.payoutAccountName || partner.partnerName}</p>
          </div>

          {enlargedQr && (
            <div className="p-3.5 bg-gradient-to-b from-amber-50 to-white rounded-3xl border-2 border-amber-300 shadow-inner inline-block">
              <img
                src={enlargedQr}
                alt="Enlarged QR Code"
                className="w-64 h-64 object-contain rounded-2xl bg-white p-2"
              />
            </div>
          )}

          <p className="text-[11px] text-[#24252c]/50">
            Scan using GCash, Maya, BDO, BPI, GoTyme, or any InstaPay-compliant banking app.
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setEnlargedQr(null)}
              className="w-full py-3 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
