import { useState, useMemo, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCheck,
  IconTicket,
  IconShield,
  IconArrow,
  IconExternal,
} from '../../components/shared/icons';
import {
  fetchAffiliateSettings,
  getStoredPartnerSession,
  type AffiliateSettings,
  DEFAULT_AFFILIATE_SETTINGS,
} from '../../utils/affiliateService';
import binhiLogo from '../../assets/branding/BINHI Concept Logo.webp';

export default function AffiliatesPage({ go }: { go: (p: Page) => void }) {
  const [settings, setSettings] = useState<AffiliateSettings>(DEFAULT_AFFILIATE_SETTINGS);

  useEffect(() => {
    fetchAffiliateSettings().then(setSettings).catch(() => {});
  }, []);

  // Interactive Calculator State
  const [calcEventsPerMonth, setCalcEventsPerMonth] = useState(3);
  const [calcAvgBookingValue, setCalcAvgBookingValue] = useState(60000);

  const calcEstimatedMonthlyIncome = useMemo(() => {
    const totalVolume = calcEventsPerMonth * calcAvgBookingValue;
    const rate = (settings.defaultCommissionRate || 5.0) / 100;
    return Math.round(totalVolume * rate);
  }, [calcEventsPerMonth, calcAvgBookingValue, settings.defaultCommissionRate]);

  const handleRegisterAsPartner = () => {
    try {
      localStorage.setItem('binhi_registration_intent', 'affiliate');
    } catch (e) {}
    go('signup');
  };

  const handleGoToPortal = () => {
    const session = getStoredPartnerSession();
    if (session) {
      go('partner-dashboard');
    } else {
      go('partner-login');
    }
  };

  return (
    <div className="min-h-screen pt-32 sm:pt-36 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 animate-fade-in">
      {/* ── Top Header Navigation ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24252c]/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <MonoBadge icon={IconTicket}>Affiliate &amp; Partner Commission Management</MonoBadge>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full">
              {settings.defaultCommissionRate}% Direct Partner Commission
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight mt-2">
            BINHI Concept Partner &amp; Affiliate Program
          </h1>
          <p className="text-xs sm:text-sm text-[#24252c]/60 mt-1 max-w-2xl">
            Monetize your event network. Recommend professional stage lighting, concert audio, and LED walls to your clients and earn generous cash commissions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGoToPortal}
            className="text-xs font-bold px-4 py-2.5 rounded-full bg-[var(--mist)] text-[var(--ink)] hover:bg-[#1090F8]/10 hover:text-[#1090F8] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <IconShield className="w-3.5 h-3.5" />
            <span>Partner Portal Sign In</span>
          </button>
          <button
            type="button"
            onClick={handleRegisterAsPartner}
            className="text-xs font-extrabold px-5 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            + Join Partner Network
          </button>
        </div>
      </div>

      {/* ── Hero Value Props Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ink)] to-[#181920] p-8 sm:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#1090F8]">
            Exclusive B2B Affiliate Ecosystem
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Turn Every Wedding, Debut &amp; Corporate Event Into Passive Revenue
          </h2>
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
            Whether you are a wedding coordinator, venue banquet manager, DJ, or production freelancer, partnering with BINHI Concept gives your clients top-tier staging while earning you up to <strong>₱{(80000 * (settings.defaultCommissionRate / 100)).toLocaleString()} – ₱{(150000 * (settings.defaultCommissionRate / 100)).toLocaleString()}+ per booking</strong>.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRegisterAsPartner}
              className="bg-emerald-500 text-white text-xs font-extrabold px-6 py-3 rounded-full hover:bg-emerald-400 transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span>Register as Partner Now</span>
              <IconArrow className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToPortal}
              className="bg-white/10 text-white text-xs font-semibold px-5 py-3 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-sm flex items-center gap-1.5"
            >
              <IconShield className="w-3.5 h-3.5" />
              <span>Partner Sign In</span>
            </button>
          </div>
        </div>

        {/* Decorative Background Glow */}
        <div className="absolute -right-12 -bottom-12 w-96 h-96 bg-[#1090F8]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-24 top-8 opacity-15 hidden lg:block pointer-events-none">
          <img src={binhiLogo} alt="BINHI" className="h-44 w-auto object-contain brightness-0 invert" />
        </div>
      </div>

      {/* ── 3 Pillars of the Program ── */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
            {settings.defaultClientDiscountRate}%
          </div>
          <h3 className="font-extrabold text-base text-[var(--ink)]">Client Gets {settings.defaultClientDiscountRate}% Discount</h3>
          <p className="text-xs text-[#24252c]/60 leading-relaxed">
            Your clients get an exclusive {settings.defaultClientDiscountRate}% promo discount off any staging package when using your custom referral code or tracking link.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1090F8] flex items-center justify-center font-black text-sm">
            ₱₱
          </div>
          <h3 className="font-extrabold text-base text-[var(--ink)]">You Earn {settings.defaultCommissionRate}% Commission</h3>
          <p className="text-xs text-[#24252c]/60 leading-relaxed">
            Earn {settings.defaultCommissionRate}% of the total event contract value. On high-tier production rigs (₱80,000–₱150,000), you earn ₱{(80000 * (settings.defaultCommissionRate / 100)).toLocaleString()} to ₱{(150000 * (settings.defaultCommissionRate / 100)).toLocaleString()}+ per event.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
            ⚡
          </div>
          <h3 className="font-extrabold text-base text-[var(--ink)]">Direct GCash / Bank Payouts</h3>
          <p className="text-xs text-[#24252c]/60 leading-relaxed">
            Fast disbursements directly to your registered GCash, Maya, or bank account as soon as the event setup is confirmed and staged, with verified proof of payment slips.
          </p>
        </div>
      </div>

      {/* ── Interactive Earnings Calculator ── */}
      <div className="p-8 rounded-3xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1090F8]">
              Interactive Simulator
            </span>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
              Calculate Your Potential Monthly Earnings
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#24252c]/50 font-medium block">Estimated Monthly Payout</span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-600">
              ₱{calcEstimatedMonthlyIncome.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-[var(--ink)]">
              <span>Referred Event Bookings / Month:</span>
              <span className="text-[#1090F8] font-extrabold">{calcEventsPerMonth} Events</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={calcEventsPerMonth}
              onChange={(e) => setCalcEventsPerMonth(Number(e.target.value))}
              className="w-full accent-[#1090F8] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#24252c]/40">
              <span>1 Event</span>
              <span>7 Events</span>
              <span>15 Events</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-[var(--ink)]">
              <span>Average Staging Package Value:</span>
              <span className="text-[#1090F8] font-extrabold">₱{calcAvgBookingValue.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="25000"
              max="150000"
              step="5000"
              value={calcAvgBookingValue}
              onChange={(e) => setCalcAvgBookingValue(Number(e.target.value))}
              className="w-full accent-[#1090F8] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#24252c]/40">
              <span>₱25,000 (Acoustic)</span>
              <span>₱60,000 (Grand)</span>
              <span>₱150,000 (Concert Rig)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── How It Works Step-by-Step ── */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-[#1090F8]">Simple Workflow</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            How The Partner Program Works
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Register Online',
              desc: 'Create your partner account in under a minute with your contact and banking details.',
            },
            {
              step: '02',
              title: 'Get Your Code',
              desc: 'Receive your unique promo code and shareable referral links from your dedicated portal.',
            },
            {
              step: '03',
              title: 'Client Books BINHI',
              desc: 'Your client enters your promo code at checkout and instantly gets an exclusive discount.',
            },
            {
              step: '04',
              title: 'Get Paid Fast',
              desc: 'Commissions are credited and disbursed straight to your GCash or bank account with proof slips.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-2 relative"
            >
              <span className="text-3xl font-black text-[#1090F8]/20">{item.step}</span>
              <h4 className="font-extrabold text-sm text-[var(--ink)]">{item.title}</h4>
              <p className="text-xs text-[#24252c]/60 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Call To Action ── */}
      <div className="p-8 sm:p-12 rounded-3xl bg-[var(--ink)] text-white text-center space-y-4 shadow-xl">
        <h3 className="text-2xl sm:text-3xl font-extrabold">Ready to Partner With BINHI Concept?</h3>
        <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto">
          Start earning consistent commissions on professional lights, concert audio, and LED staging for your events today.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={handleRegisterAsPartner}
            className="bg-emerald-500 text-white text-xs font-extrabold px-6 py-3.5 rounded-full hover:bg-emerald-400 transition-all shadow-lg cursor-pointer flex items-center gap-2"
          >
            <span>Create Partner Account</span>
            <IconArrow className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleGoToPortal}
            className="bg-white/10 text-white text-xs font-semibold px-5 py-3.5 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-sm"
          >
            Sign in to Existing Account
          </button>
        </div>
      </div>
    </div>
  );
}
