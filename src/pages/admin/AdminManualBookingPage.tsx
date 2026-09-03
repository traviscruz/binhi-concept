import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { supabase } from '../../lib/supabase';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';
import { validateVoucherCode, recordVoucherUsage } from '../../utils/voucherService';

import type {
  TransportRuleOption,
  AddonModel,
  AddonSelection,
  ManualBookingSuccessData,
} from '../../components/admin/manual-booking/types';
import { ManualBookingStep1 } from '../../components/admin/manual-booking/ManualBookingStep1';
import { ManualBookingStep2 } from '../../components/admin/manual-booking/ManualBookingStep2';
import { ManualBookingStep3 } from '../../components/admin/manual-booking/ManualBookingStep3';
import { ManualBookingSuccess } from '../../components/admin/manual-booking/ManualBookingSuccess';

export default function AdminManualBookingPage({ go }: { go: (p: Page) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1: Client & Event State ──────────────────────────────────────────
  const [channel, setChannel] = useState('Walk-in');
  const [customChannel, setCustomChannel] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');

  // ── Packages & Addons State ───────────────────────────────────────────────
  const [packagesList, setPackagesList] = useState<PackageData[]>(FEATURED_PACKAGES);
  const [selectedPkgId, setSelectedPkgId] = useState<string>(FEATURED_PACKAGES[0]?.id || 'a');
  const [addonModels, setAddonModels] = useState<AddonModel[]>([]);
  const [addonSelections, setAddonSelections] = useState<AddonSelection>({});

  // ── Event Info State ──────────────────────────────────────────────────────
  const [eventType, setEventType] = useState('Birthday / Debut Celebration');
  const [eventDate, setEventDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  // ── Step 2: Logistics State ───────────────────────────────────────────────
  const [transportRules, setTransportRules] = useState<TransportRuleOption[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [venueAddress, setVenueAddress] = useState('');
  const [isLocationValid, setIsLocationValid] = useState(true);

  // ── Step 3: Payment & Proof State ─────────────────────────────────────────
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Hand / Office');
  const [customMethod, setCustomMethod] = useState('');
  const [paymentRefNumber, setPaymentRefNumber] = useState(
    () => `BNH-MANUAL-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>('');

  // ── Promo Code State ──────────────────────────────────────────────────────
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState('');

  // ── Validation & Status States ────────────────────────────────────────────
  const [step1Error, setStep1Error] = useState('');
  const [step2Error, setStep2Error] = useState('');
  const [step3Error, setStep3Error] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successBookingData, setSuccessBookingData] = useState<ManualBookingSuccessData | null>(null);

  // Load Bookings for conflict checking
  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  // Load Packages
  useEffect(() => {
    async function fetchPackages() {
      try {
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          const formatted: PackageData[] = data.map((item: any) => ({
            id: item.package_id || item.id,
            name: item.name,
            tag: item.tag || 'Standard Setup',
            price: item.price || `₱${(Number(item.raw_price) || 0).toLocaleString()}`,
            rawPrice: Number(item.raw_price) || parseInt((item.price || '').replace(/\D/g, '')) || 0,
            desc: item.description || '',
            img: item.img || '',
            photos: item.photos || [],
            inclusions: item.inclusions || [],
            recommendedFor: item.recommended_for || [],
            specs: item.specs || { powerReq: '', setupTime: '', crewSize: '' },
          }));
          setPackagesList(formatted);
          if (formatted.length > 0) {
            setSelectedPkgId(formatted[0].id);
          }
        }
      } catch (err) {
        console.warn('Note fetching packages for manual booking:', err);
      }
    }
    fetchPackages();
  }, []);

  // Load Transport Rules
  useEffect(() => {
    async function fetchDbTransportRules() {
      try {
        const { data, error } = await supabase
          .from('transport_rules')
          .select('*')
          .eq('status', 'Active')
          .order('region', { ascending: true });

        if (!error && data && data.length > 0) {
          const formatted: TransportRuleOption[] = data.map((item: any) => ({
            id: item.id,
            region: item.region,
            baseFee: Number(item.base_fee ?? 0),
          }));
          setTransportRules(formatted);
          setSelectedRuleId(formatted[0].id);
        } else {
          const fallbackRules = [
            { id: 'tr-1', region: 'Metro Manila (NCR)', baseFee: 1500 },
            { id: 'tr-2', region: 'Cavite (CALABARZON)', baseFee: 3500 },
            { id: 'tr-3', region: 'Laguna / Batangas', baseFee: 4500 },
            { id: 'tr-4', region: 'Bulacan / Pampanga', baseFee: 4000 },
          ];
          setTransportRules(fallbackRules);
          setSelectedRuleId(fallbackRules[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch transport rules:', err);
      }
    }
    fetchDbTransportRules();
  }, []);

  // Load Inventory Add-ons
  useEffect(() => {
    async function fetchAvailableInventory() {
      try {
        const { data: units, error } = await supabase
          .from('physical_units')
          .select(`
            model_id,
            status,
            equipment_models (
              model_id,
              name,
              brand,
              category,
              rental_rate
            )
          `)
          .eq('status', 'Available in Warehouse');

        if (error) throw error;

        const modelMap: Record<string, AddonModel> = {};
        (units ?? []).forEach((unit: any) => {
          const em = unit.equipment_models;
          if (!em) return;
          const mid = em.model_id;
          if (!modelMap[mid]) {
            modelMap[mid] = {
              modelId: mid,
              name: em.name,
              brand: em.brand,
              category: em.category,
              rentalRate: Number(em.rental_rate ?? 0),
              availableCount: 0,
            };
          }
          modelMap[mid].availableCount += 1;
        });

        const sorted = Object.values(modelMap).sort((a, b) => a.name.localeCompare(b.name));
        setAddonModels(sorted);
      } catch (err) {
        console.warn('Note fetching add-on models for manual booking:', err);
      }
    }
    fetchAvailableInventory();
  }, []);

  const selectedPkg = packagesList.find((p) => p.id === selectedPkgId) || packagesList[0];

  const setAddonQty = (modelId: string, qty: number) => {
    setAddonSelections((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[modelId];
        return next;
      }
      return { ...prev, [modelId]: qty };
    });
  };

  const getAddonQty = (modelId: string) => addonSelections[modelId] ?? 0;

  const selectedAddonStrings = Object.entries(addonSelections)
    .filter(([_, qty]) => qty > 0)
    .map(([mid, qty]) => {
      const m = addonModels.find((model) => model.modelId === mid);
      const name = m ? m.name : 'Equipment Item';
      const rate = m ? m.rentalRate : 0;
      return `${qty}x ${name} (+₱${(qty * rate).toLocaleString()})`;
    });

  // ── Calculation Formulas ──────────────────────────────────────────────────
  const currentPkgPrice = Number(selectedPkg?.rawPrice ?? 0);

  const addonsCost = Object.entries(addonSelections).reduce((sum, [mid, qty]) => {
    const m = addonModels.find((model) => model.modelId === mid);
    return sum + (m ? m.rentalRate * qty : 0);
  }, 0);

  const packageAndAddonPrice = currentPkgPrice + addonsCost;

  const currentSelectedRule = transportRules.find((r) => r.id === selectedRuleId) || transportRules[0];
  const transportFee = currentSelectedRule ? currentSelectedRule.baseFee : 1500;
  const locationRegionName = currentSelectedRule ? currentSelectedRule.region : 'Selected Location';

  const subtotalBeforeDiscount = packageAndAddonPrice + transportFee;

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'percentage') {
      discountAmount = Math.round((subtotalBeforeDiscount * appliedPromo.discountValue) / 100);
    } else {
      discountAmount = Math.min(appliedPromo.discountValue, subtotalBeforeDiscount);
    }
  }

  const totalCost = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const depositRequired = Math.round(totalCost * 0.5);
  const balanceDueOnEventDate = totalCost - depositRequired;
  const isFullPayment = paymentType === 'full';
  const amountDueToday = isFullPayment ? totalCost : depositRequired;
  const remainingBalanceAmount = isFullPayment ? 0 : balanceDueOnEventDate;

  // ── Availability & Validation ─────────────────────────────────────────────
  const checkLiveAvailability = async (targetDate: string): Promise<boolean> => {
    try {
      const freshBookings = await fetchDbBookedDates();
      setDbBookings(freshBookings);
      const isTaken = freshBookings.some((b) => b.event_date === targetDate);
      return !isTaken;
    } catch (e) {
      return true;
    }
  };

  const validateAddressAgainstRegion = (addr: string, ruleId: string) => {
    const rule = transportRules.find((r) => r.id === ruleId);
    if (!rule || !addr.trim()) {
      setIsLocationValid(true);
      setStep2Error('');
      return true;
    }

    const addrText = addr.toLowerCase();
    const regionText = rule.region.toLowerCase();

    const keywords = regionText
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && w !== 'region');

    if (regionText.includes('ncr') || regionText.includes('metro manila')) {
      keywords.push(
        'manila', 'quezon', 'taguig', 'bgc', 'makati', 'pasig', 'mandaluyong',
        'paranaque', 'las pinas', 'muntinlupa', 'marikina', 'pasay', 'malabon',
        'navotas', 'valenzuela', 'san juan'
      );
    }

    const matches = keywords.some((kw) => addrText.includes(kw));

    if (!matches && keywords.length > 0) {
      setIsLocationValid(false);
      setStep2Error(`Notice: Selected venue address does not match chosen coverage region "${rule.region}".`);
      return false;
    }

    setIsLocationValid(true);
    setStep2Error('');
    return true;
  };

  // ── Step Navigation Handlers ──────────────────────────────────────────────
  const handleNextStep1 = async () => {
    setStep1Error('');
    if (channel === 'Other' && !customChannel.trim()) {
      setStep1Error('Please specify the other platform or booking channel.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setStep1Error('First name and last name are required.');
      return;
    }
    if (!email.trim()) {
      setStep1Error('Email address is required.');
      return;
    }
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
      setStep1Error('Mobile phone number must be 10 digits starting with 9 (e.g. 9171234567).');
      return;
    }
    if (!eventDate) {
      setStep1Error('Please select the event date.');
      return;
    }
    if (isPastDate(eventDate)) {
      setStep1Error('The selected event date is in the past. Please pick a future date.');
      return;
    }

    const isAvailable = await checkLiveAvailability(eventDate);
    if (!isAvailable) {
      setStep1Error(`Date Conflict: The date ${eventDate} is already booked. Please select an available date.`);
      return;
    }

    if (!eventDescription.trim()) {
      setStep1Error('Please fill out "Tell Me About Your Event" (required).');
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep2 = async () => {
    setStep2Error('');
    if (!venueAddress.trim()) {
      setStep2Error('Please enter the venue name and full address.');
      return;
    }

    const isValid = validateAddressAgainstRegion(venueAddress, selectedRuleId);
    if (!isValid) return;

    const isAvailable = await checkLiveAvailability(eventDate);
    if (!isAvailable) {
      setStep2Error(`Date Conflict: The date ${eventDate} was just reserved. Please pick another date.`);
      return;
    }

    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyPromo = async () => {
    setPromoError('');
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) {
      setPromoError('Please enter a promo code.');
      return;
    }

    const result = await validateVoucherCode(cleaned);
    if (result.valid && result.voucher) {
      setAppliedPromo({
        code: result.voucher.code,
        description:
          result.voucher.description ||
          `${result.voucher.discount_value}${result.voucher.discount_type === 'percentage' ? '%' : '₱'} Discount`,
        discountType: result.voucher.discount_type,
        discountValue: result.voucher.discount_value,
      });
      setPromoInput('');
    } else {
      setPromoError(result.error || `"${cleaned}" is not a valid promo code.`);
    }
  };

  const handleSubmitManualBooking = async () => {
    setStep3Error('');
    if (!proofFile && !proofPreview) {
      setStep3Error('Please attach a proof of payment (screenshot, slip, or cash receipt).');
      return;
    }

    setSubmitting(true);

    try {
      const isAvailable = await checkLiveAvailability(eventDate);
      if (!isAvailable) {
        setStep3Error(`Date Conflict: ${eventDate} is already reserved in the database.`);
        setSubmitting(false);
        return;
      }

      let receiptUrl = proofPreview || '';

      if (proofFile) {
        try {
          const fileExt = proofFile.name.split('.').pop() || 'png';
          const fileName = `manual-receipts/admin-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('booking-receipts')
            .upload(fileName, proofFile, { upsert: true });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('booking-receipts').getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
              receiptUrl = publicUrlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload fallback to preview data URL:', storageErr);
        }
      }

      const finalMethod =
        paymentMethod === 'Other Payment Method'
          ? customMethod.trim() || 'Other Payment Method'
          : paymentMethod;

      const finalChannel =
        channel === 'Other' ? customChannel.trim() || 'Other' : channel;

      const fullCustomerName = `${firstName.trim()} ${lastName.trim()}`;
      const promoSuffix = appliedPromo
        ? `\n[Promo Code: ${appliedPromo.code} (-₱${discountAmount.toLocaleString()})]`
        : '';
      const finalDescription = `[Booking Channel: ${finalChannel}]\n${eventDescription}${promoSuffix}`;

      const bookingPayload: any = {
        package_id: selectedPkg.id,
        package_name: selectedPkg.name,
        package_price: currentPkgPrice,
        addons_cost: addonsCost,
        event_type: eventType,
        event_date: eventDate,
        event_description: finalDescription,
        venue_address: venueAddress,
        region_rule_id: selectedRuleId,
        transport_fee: transportFee,
        total_cost: totalCost,
        deposit_amount: amountDueToday,
        is_fully_paid: isFullPayment,
        remaining_balance: remainingBalanceAmount,
        payment_status: 'paid',
        payment_channel: `${finalChannel} (${finalMethod})`,
        paymongo_reference_number: paymentRefNumber.trim() || `BNH-MANUAL-${Date.now().toString().slice(-6)}`,
        customer_name: fullCustomerName,
        customer_email: email.trim(),
        customer_phone: `+63 ${phoneDigits.trim()}`,
        guest_count: 100,
        selected_addons: selectedAddonStrings,
        balance_payment_method: finalMethod,
        balance_receipt_url: receiptUrl,
        deposit_receipt_url: receiptUrl,
        balance_paid_at: isFullPayment ? new Date().toISOString() : null,
        booking_source: finalChannel,
      };

      const { error: insertError } = await supabase.from('bookings').insert(bookingPayload);

      if (insertError) {
        delete bookingPayload.deposit_receipt_url;
        delete bookingPayload.booking_source;
        const { error: fallbackErr } = await supabase.from('bookings').insert(bookingPayload);
        if (fallbackErr) throw fallbackErr;
      }

      if (appliedPromo?.code) {
        try {
          await recordVoucherUsage(appliedPromo.code);
        } catch (vErr) {
          console.warn('Note recording voucher usage:', vErr);
        }
      }

      setSuccessBookingData({
        ref: bookingPayload.paymongo_reference_number,
        customer: fullCustomerName,
        channel: finalChannel,
        package: selectedPkg.name,
        date: eventDate,
        total: totalCost,
        paid: amountDueToday,
        balance: remainingBalanceAmount,
        receiptUrl: receiptUrl,
        isFull: isFullPayment,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to create manual booking:', err);
      setStep3Error(err?.message || 'Failed to save booking. Please check database connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessBookingData(null);
    setStep(1);
    setChannel('Walk-in');
    setCustomChannel('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneDigits('');
    setEventDate('');
    setEventDescription('');
    setVenueAddress('');
    setProofFile(null);
    setProofPreview('');
    setPaymentRefNumber(`BNH-MANUAL-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  // ── Confirmation Screen ───────────────────────────────────────────────────
  if (successBookingData) {
    return (
      <ManualBookingSuccess
        data={successBookingData}
        onGoToBookings={() => go('admin-bookings')}
        onBookAnother={handleResetForm}
      />
    );
  }

  // ── Main Page Layout (Customer Checkout Parity) ───────────────────────────
  return (
    <section className="py-8 px-4 sm:px-8 max-w-4xl mx-auto space-y-6">
      {/* Boutique Split-Card Step Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => go('admin-bookings')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors group cursor-pointer"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back to Bookings Manager
          </button>
          <div className="text-right">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#24252c]/50 block">
              Booking Summary
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-[var(--ink)]">
              {selectedPkg.name} ·{' '}
              <span className="text-[#1090F8]">
                ₱{(step === 1 ? packageAndAddonPrice : totalCost).toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {[
            { num: '01', title: 'Client & Event', desc: 'Contact & Package', s: 1 },
            { num: '02', title: 'Venue & Logistics', desc: 'Location Fee', s: 2 },
            {
              num: '03',
              title: 'Payment Plan',
              desc: paymentType === 'full' ? '100% Full Payment' : '50% Downpayment',
              s: 3,
            },
          ].map((st) => {
            const isActive = step === st.s;
            const isDone = step > st.s;
            const canClick = st.s <= step || isDone;

            return (
              <div
                key={st.s}
                onClick={() => canClick && setStep(st.s as 1 | 2 | 3)}
                className={`p-2.5 sm:p-4 rounded-2xl border transition-all duration-300 ${
                  canClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${
                  isActive
                    ? 'bg-[#161823] text-white border-[#161823] shadow-lg scale-[1.01]'
                    : isDone
                    ? 'bg-white border-emerald-500/30 text-[var(--ink)] hover:border-emerald-500'
                    : 'bg-white border-[#24252c]/[0.08] text-[var(--ink)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span
                    className={`text-[9px] sm:text-[11px] font-extrabold mono ${
                      isActive
                        ? 'text-[#1090F8]'
                        : isDone
                        ? 'text-emerald-500'
                        : 'text-[#24252c]/40'
                    }`}
                  >
                    {isDone ? 'DONE' : `STEP ${st.num}`}
                  </span>
                </div>
                <h4 className="font-extrabold text-[11px] sm:text-xs tracking-tight truncate">{st.title}</h4>
                <p
                  className={`text-[9px] sm:text-[10px] mt-0.5 truncate ${
                    isActive ? 'text-white/60' : 'text-[#24252c]/50'
                  }`}
                >
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <ManualBookingStep1
          channel={channel}
          setChannel={setChannel}
          customChannel={customChannel}
          setCustomChannel={setCustomChannel}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          email={email}
          setEmail={setEmail}
          phoneDigits={phoneDigits}
          setPhoneDigits={setPhoneDigits}
          packagesList={packagesList}
          selectedPkgId={selectedPkgId}
          setSelectedPkgId={setSelectedPkgId}
          addonModels={addonModels}
          addonSelections={addonSelections}
          setAddonQty={setAddonQty}
          getAddonQty={getAddonQty}
          addonsCost={addonsCost}
          selectedAddonStrings={selectedAddonStrings}
          eventType={eventType}
          setEventType={setEventType}
          eventDate={eventDate}
          setEventDate={setEventDate}
          eventDescription={eventDescription}
          setEventDescription={setEventDescription}
          dbBookings={dbBookings}
          currentPkgPrice={currentPkgPrice}
          packageAndAddonPrice={packageAndAddonPrice}
          selectedPkg={selectedPkg}
          error={step1Error}
          onNext={handleNextStep1}
        />
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <ManualBookingStep2
          selectedRuleId={selectedRuleId}
          setSelectedRuleId={setSelectedRuleId}
          transportRules={transportRules}
          venueAddress={venueAddress}
          setVenueAddress={setVenueAddress}
          isLocationValid={isLocationValid}
          setIsLocationValid={setIsLocationValid}
          validateAddressAgainstRegion={validateAddressAgainstRegion}
          packageAndAddonPrice={packageAndAddonPrice}
          transportFee={transportFee}
          locationRegionName={locationRegionName}
          totalCost={totalCost}
          error={step2Error}
          onBack={() => setStep(1)}
          onNext={handleNextStep2}
        />
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <ManualBookingStep3
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          depositRequired={depositRequired}
          balanceDueOnEventDate={balanceDueOnEventDate}
          totalCost={totalCost}
          promoOpen={promoOpen}
          setPromoOpen={setPromoOpen}
          promoInput={promoInput}
          setPromoInput={setPromoInput}
          appliedPromo={appliedPromo}
          setAppliedPromo={setAppliedPromo}
          promoError={promoError}
          setPromoError={setPromoError}
          handleApplyPromo={handleApplyPromo}
          discountAmount={discountAmount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          customMethod={customMethod}
          setCustomMethod={setCustomMethod}
          paymentRefNumber={paymentRefNumber}
          setPaymentRefNumber={setPaymentRefNumber}
          proofFile={proofFile}
          setProofFile={setProofFile}
          proofPreview={proofPreview}
          setProofPreview={setProofPreview}
          selectedPkg={selectedPkg}
          currentPkgPrice={currentPkgPrice}
          addonsCost={addonsCost}
          selectedAddonStrings={selectedAddonStrings}
          locationRegionName={locationRegionName}
          transportFee={transportFee}
          amountDueToday={amountDueToday}
          remainingBalanceAmount={remainingBalanceAmount}
          isFullPayment={isFullPayment}
          submitting={submitting}
          error={step3Error}
          onBack={() => setStep(2)}
          onSubmit={handleSubmitManualBooking}
        />
      )}
    </section>
  );
}
