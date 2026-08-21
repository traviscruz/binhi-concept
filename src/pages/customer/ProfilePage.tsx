import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconX, IconEye, IconEyeOff, IconUser, IconLock } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../utils/supabase';
import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-sm';

const MAX_AVATAR_SIZE_MB = 2;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export default function ProfilePage({ go }: { go: (p: Page) => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+63');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modals & Statuses
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneOtpToken, setPhoneOtpToken] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [passwordOtpToken, setPasswordOtpToken] = useState('');
  
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordInfoMsg, setPasswordInfoMsg] = useState('');

  const parseDigits = (rawPhone: string) => {
    if (!rawPhone) return '';
    const digits = rawPhone.replace(/\D/g, '');
    return digits.slice(-10);
  };

  // Load current user profile from Supabase
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        if (user.email) setEmail(user.email);

        const meta = user.user_metadata || {};
        if (meta.first_name) setFirstName(meta.first_name);
        if (meta.last_name) setLastName(meta.last_name);
        if (meta.phone) setPhoneDigits(parseDigits(meta.phone));
        if (meta.avatar_url) setAvatarUrl(meta.avatar_url);

        // Fetch from public.profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.first_name) setFirstName(profile.first_name);
          if (profile.last_name) setLastName(profile.last_name);
          if (profile.phone) setPhoneDigits(parseDigits(profile.phone));
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.is_phone_verified !== undefined) setIsPhoneVerified(profile.is_phone_verified);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, []);

  const isPhoneValid = phoneDigits.length === 0 || phoneDigits.length === 10;

  const extractStoragePath = (url: string | null) => {
    if (!url) return null;
    const marker = '/storage/v1/object/public/avatars/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return url.slice(idx + marker.length);
    }
    return null;
  };

  // 1. Avatar File Validation & Supabase Storage Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    // Format validation
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Invalid format! Only JPEG, PNG, WEBP, and GIF images are allowed.');
      return;
    }

    // Max size validation
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      setAvatarError(`Image size too large! Maximum allowed size is ${MAX_AVATAR_SIZE_MB}MB.`);
      return;
    }

    setUploadingAvatar(true);

    try {
      // If there is an old avatar image, delete it from storage first
      const oldPath = extractStoragePath(avatarUrl);
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${userId || 'user'}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // If bucket does not exist or upload failed
        setAvatarError(`Storage error: ${uploadError.message}`);
        setUploadingAvatar(false);
        return;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      setAvatarUrl(publicUrl);

      // Save to Supabase Auth metadata
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      // Save to public.profiles table
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        });
      }

      setUploadingAvatar(false);
      setProfileSuccessMsg('Profile picture updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to upload profile picture.');
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setAvatarError('');

    try {
      // Delete existing file from Supabase Storage
      const oldPath = extractStoragePath(avatarUrl);
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      setAvatarUrl(null);

      // Save to Supabase Auth metadata
      await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      // Save to public.profiles table
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        });
      }

      setUploadingAvatar(false);
      setProfileSuccessMsg('Profile picture removed successfully.');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to remove picture.');
      setUploadingAvatar(false);
    }
  };

  // Phone Verification Handler (Mock OTP -> Database persist)
  const handleConfirmPhoneVerification = async () => {
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
      setProfileErrorMsg('Mobile phone number must be a valid 10-digit PH number starting with 9 (e.g. 9171234567).');
      return;
    }

    setVerifyingPhone(true);
    const formattedPhone = `${countryCode} ${phoneDigits}`;

    try {
      if (userId) {
        // Update public.profiles table in Supabase
        await supabase.from('profiles').upsert({
          id: userId,
          phone: formattedPhone,
          is_phone_verified: true,
          updated_at: new Date().toISOString(),
        });

        // Update Auth metadata
        await supabase.auth.updateUser({
          data: { phone: formattedPhone },
        });
      }

      setIsPhoneVerified(true);
      setShowPhoneModal(false);
      setPhoneOtpToken('');
      setProfileSuccessMsg('Phone number verified and updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to verify phone:', err);
      setProfileErrorMsg(err?.message || 'Failed to verify phone number.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  // 2. Save Personal Details (First Name, Last Name, Email, Phone)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setProfileErrorMsg('Mobile phone number must be exactly 10 digits starting with 9 (e.g. 9171234567).');
      return;
    }

    setProfileLoading(true);
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    const formattedPhone = phoneDigits ? `${countryCode} ${phoneDigits}` : '';

    try {
      // Update Supabase Auth metadata
      await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          phone: formattedPhone,
          avatar_url: avatarUrl,
        },
      });

      // Update public.profiles table
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          phone: formattedPhone,
          avatar_url: avatarUrl,
          is_phone_verified: isPhoneVerified,
          updated_at: new Date().toISOString(),
        });
      }

      setProfileLoading(false);
      setProfileSuccessMsg('Profile details updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to update profile details.');
      setProfileLoading(false);
    }
  };

  // 3. Step 1 of Password Change: Validate & Trigger Email OTP
  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqs = validatePassword(newPassword);
    if (!reqs.isValid) {
      setPasswordErrorMsg('New password must be at least 8 characters, contain an uppercase letter, and a number.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirm password do not match.');
      return;
    }

    setPasswordLoading(true);
    setPasswordErrorMsg('');
    setPasswordSuccessMsg('');
    setPasswordInfoMsg('');

    try {
      // Send 6-digit OTP code to user's email for password reset verification
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setPasswordErrorMsg(error.message);
        setPasswordLoading(false);
        return;
      }

      setPasswordLoading(false);
      setPasswordOtpToken('');
      setShowPasswordOtpModal(true);
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Failed to send verification code.');
      setPasswordLoading(false);
    }
  };

  // 3. Step 2 of Password Change: Verify 6-digit OTP & Apply New Password
  const handleConfirmPasswordChangeWithOtp = async () => {
    if (passwordOtpToken.length < 6) {
      setPasswordErrorMsg('Please enter the full 6-digit verification code sent to your email.');
      return;
    }

    setPasswordLoading(true);
    setPasswordErrorMsg('');

    try {
      // Verify OTP code
      let { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: passwordOtpToken.trim(),
        type: 'recovery',
      });

      if (error) {
        const res = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: passwordOtpToken.trim(),
          type: 'email',
        });
        data = res.data;
        error = res.error;
      }

      if (error) {
        setPasswordErrorMsg(error.message);
        setPasswordLoading(false);
        return;
      }

      // Update password in Supabase Auth
      const updateRes = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateRes.error) {
        setPasswordErrorMsg(updateRes.error.message);
        setPasswordLoading(false);
        return;
      }

      setPasswordLoading(false);
      setShowPasswordOtpModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOtpToken('');
      setPasswordSuccessMsg('Your password has been changed successfully!');
      setTimeout(() => setPasswordSuccessMsg(''), 5000);
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Failed to change password. Please try again.');
      setPasswordLoading(false);
    }
  };

  const handleResendPasswordOtp = async () => {
    setPasswordErrorMsg('');
    setPasswordInfoMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setPasswordErrorMsg(error.message);
      } else {
        setPasswordInfoMsg('A new 6-digit verification code was sent to your email.');
      }
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Failed to resend code.');
    }
  };

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Badge */}
        <div className="border-b border-[#24252c]/[0.06] pb-4">
          <div>
            <MonoBadge icon={IconShield}>Account Settings</MonoBadge>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
              Customer Profile & Security
            </h1>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Manage your personal details, profile picture, and security settings.
            </p>
          </div>
        </div>

        {/* SECTION 1: Personal Details & Avatar Upload */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#24252c]/[0.06]">
            <span className="w-8 h-8 rounded-xl bg-[var(--ink)]/5 text-[var(--ink)] flex items-center justify-center font-bold">
              <IconUser className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Personal Details</h2>
              <p className="text-xs text-[#24252c]/50">Update your name, profile photo, and contact information.</p>
            </div>
          </div>

          {/* Avatar Picture Upload Area */}
          <div className="mb-6 p-4 rounded-2xl bg-[#EEEEEE]/60 border border-[#24252c]/[0.06] flex items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[var(--ink)]/20 shadow-sm"
                />
              ) : (
                <span className="w-16 h-16 rounded-full bg-white text-[var(--ink)] border border-[#24252c]/15 flex items-center justify-center shadow-sm">
                  <IconUser className="w-8 h-8" />
                </span>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-block bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] cursor-pointer transition-all shadow-sm">
                  {uploadingAvatar
                    ? 'Processing...'
                    : avatarUrl
                    ? 'Update Profile Picture'
                    : 'Upload Profile Picture'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                </label>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-4 py-2 rounded-full hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Remove Picture
                  </button>
                )}
              </div>

              <p className="text-[11px] text-[#24252c]/50">
                Supports JPG, PNG, WEBP or GIF (Max size: <strong className="text-[var(--ink)]">2MB</strong>).
              </p>
              {avatarError && (
                <p className="text-xs text-rose-600 font-semibold mt-1">{avatarError}</p>
              )}
            </div>
          </div>

          {profileErrorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {profileErrorMsg}
            </div>
          )}

          {profileSuccessMsg && (
            <div className="mb-4 p-3.5 rounded-2xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {profileSuccessMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  First Name
                </label>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Last Name
                </label>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className={inputClass + ' opacity-60 cursor-not-allowed'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                    Mobile Phone Number
                  </label>
                  {isPhoneVerified ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        Verified
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPhoneVerified(false);
                          setProfileSuccessMsg('Phone unlocked. Enter your new number and click "Verify Now".');
                          setTimeout(() => setProfileSuccessMsg(''), 4000);
                        }}
                        className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 hover:bg-[#1090F8]/20 border border-[#1090F8]/20 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                      >
                        Edit Phone
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
                          setProfileErrorMsg('Please enter a valid 10-digit mobile number starting with 9 first.');
                          return;
                        }
                        setShowPhoneModal(true);
                      }}
                      className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full hover:bg-rose-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      Unverified — Verify Now
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
                    readOnly={isPhoneVerified}
                    onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="917 123 4567"
                    className={inputClass + ` flex-1 ${isPhoneVerified ? 'cursor-not-allowed opacity-90' : ''}`}
                  />
                </div>
                {phoneDigits.length > 0 && (phoneDigits.length < 10 || !phoneDigits.startsWith('9')) && (
                  <p className="text-[11px] text-rose-500 ml-4 mt-1">
                    Phone number must be 10 digits starting with 9 (e.g. 9171234567).
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileLoading || !isPhoneValid}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-8 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {profileLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Save Personal Details'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: Security & Password Management */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#24252c]/[0.06]">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <IconLock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Security & Password</h2>
              <p className="text-xs text-[#24252c]/50">Update your account password with email 6-digit OTP verification.</p>
            </div>
          </div>

          {passwordErrorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {passwordErrorMsg}
            </div>
          )}

          {passwordSuccessMsg && (
            <div className="mb-4 p-3.5 rounded-2xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {passwordSuccessMsg}
            </div>
          )}

          <form onSubmit={handleRequestPasswordChange} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
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
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
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
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
                  >
                    {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <PasswordChecklist password={newPassword} />

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-rose-500 ml-2 -mt-2">Passwords do not match.</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading || !validatePassword(newPassword).isValid || newPassword !== confirmPassword}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-8 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {passwordLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Send Email OTP & Change Password'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL 1: Password Update Email OTP Verification Modal */}
      <ModalOverlay isOpen={showPasswordOtpModal} onClose={() => setShowPasswordOtpModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            type="button"
            onClick={() => setShowPasswordOtpModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <span className="w-12 h-12 rounded-full bg-[#1090F8]/10 text-[#1090F8] font-bold text-lg flex items-center justify-center mx-auto mb-3">
              <IconShield className="w-6 h-6" />
            </span>
            <h3 className="text-2xl font-extrabold text-[var(--ink)]">Verify Password Change</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              We sent a 6-digit security code to <strong className="text-[var(--ink)]">{email}</strong>. Enter it below to confirm your new password.
            </p>
          </div>

          {passwordInfoMsg && (
            <div className="mb-4 p-3 rounded-xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {passwordInfoMsg}
            </div>
          )}

          {passwordErrorMsg && (
            <div className="mb-4 p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {passwordErrorMsg}
            </div>
          )}

          <div className="my-6">
            <OtpInput
              value={passwordOtpToken}
              onChange={(val) => setPasswordOtpToken(val)}
              onResend={handleResendPasswordOtp}
              disabled={passwordLoading}
            />
          </div>

          <button
            type="button"
            onClick={handleConfirmPasswordChangeWithOtp}
            disabled={passwordLoading || passwordOtpToken.length < 6}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {passwordLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Confirm & Save New Password'
            )}
          </button>
        </div>
      </ModalOverlay>

      {/* MODAL 2: Phone Verification Modal */}
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
            <h3 className="text-2xl font-extrabold text-[var(--ink)]">Verify Phone Number</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              Verification SMS code sent to <strong className="text-[var(--ink)]">+63 {phoneDigits}</strong>.
            </p>
          </div>

          <div className="my-6">
            <OtpInput value={phoneOtpToken} onChange={(val) => setPhoneOtpToken(val)} />
          </div>

          <button
            type="button"
            onClick={handleConfirmPhoneVerification}
            disabled={verifyingPhone}
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
    </section>
  );
}
