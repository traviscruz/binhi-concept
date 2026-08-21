import { useState, useEffect, useRef } from 'react';

import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconX, IconCheck } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';
import { createPaymongoCheckoutSession } from '../../utils/paymongoPayment';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';

declare global {
  interface Window {
    google?: any;
  }
}

interface TransportRuleOption {
  id: string;
  region: string;
  baseFee: number;
}

export default function CheckoutPage({
  packageId,
  initialDate,
  initialAddons,
  go,
  packages = [],
}: {
  packageId: string;
  initialDate: string;
  initialAddons: string[];
  go: (p: Page) => void;
  packages?: PackageData[];
}) {
  const allPackages = packages && packages.length > 0 ? packages : FEATURED_PACKAGES;
  const pkg = allPackages.find((p) => p.id === packageId) || allPackages[0];
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Profile / Contact State ────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode] = useState('+63');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // Helper to format ISO YYYY-MM-DD for HTML5 date input
  const formatIsoDate = (dString?: string) => {
    if (!dString) return '2026-09-14';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dString)) return dString;
    try {
      const parsed = new Date(dString);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch (e) {}
    return '2026-09-14';
  };

  // ── Event Info State ───────────────────────────────────────────────────────
  const [eventType, setEventType] = useState('Birthday / Debut Celebration');
  const [eventDate, setEventDate] = useState(() => {
    const saved = localStorage.getItem('binhi_selected_event_date');
    return saved ? formatIsoDate(saved) : formatIsoDate(initialDate);
  });
  const [eventDescription, setEventDescription] = useState('');
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  // ── Logistics State (Fetched from DB transport_rules) ──────────────────────
  const [transportRules, setTransportRules] = useState<TransportRuleOption[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [transportLoading, setTransportLoading] = useState(true);
  const [venueAddress, setVenueAddress] = useState('');
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [selectedAddons] = useState<string[]>(initialAddons);
  const [receiptUploaded, setReceiptUploaded] = useState(false);

  // ── Error & Modal States ──────────────────────────────────────────────────
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneOtpToken, setPhoneOtpToken] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneModalError, setPhoneModalError] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const [step2Error, setStep2Error] = useState('');
  const [step3Error, setStep3Error] = useState('');
  const [bookingSuccessModal, setBookingSuccessModal] = useState(false);

  const [profileLoading, setProfileLoading] = useState(true);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  // Helper to extract 10 digits
  const parseDigits = (rawPhone: string) => {
    if (!rawPhone) return '';
    const digits = rawPhone.replace(/\D/g, '');
    return digits.slice(-10);
  };

  // ── 1. Fetch DB Transport Rules ───────────────────────────────────────────
  useEffect(() => {
    async function fetchDbTransportRules() {
      setTransportLoading(true);
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
          setSelectedRuleId((prev) => (prev && formatted.some((f) => f.id === prev) ? prev : formatted[0].id));
        } else {
          const fallbackRules = [
            { id: 'tr-1', region: 'Metro Manila (NCR)', baseFee: 1500 },
            { id: 'tr-2', region: 'Cavite (CALABARZON)', baseFee: 3500 },
            { id: 'tr-3', region: 'Laguna / Batangas', baseFee: 4500 },
            { id: 'tr-4', region: 'Bulacan / Pampanga', baseFee: 4000 },
          ];
          setTransportRules(fallbackRules);
          setSelectedRuleId((prev) => (prev && fallbackRules.some((f) => f.id === prev) ? prev : fallbackRules[0].id));
        }
      } catch (err) {
        console.error('Failed to fetch transport rules:', err);
      } finally {
        setTransportLoading(false);
      }
    }

    fetchDbTransportRules();
  }, []);

  // ── 2. Load Google Maps & Places API Script using .env Key ───────────────
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    if (document.getElementById('google-places-script')) {
      if (window.google?.maps?.places) {
        initGooglePlacesAutocomplete();
        if (step === 2) {
          initGoogleMap();
        }
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      initGooglePlacesAutocomplete();
      if (step === 2) {
        initGoogleMap();
      }
    };
    document.head.appendChild(script);
  }, []);

  // Initialize Map and Autocomplete when Step 2 becomes active
  useEffect(() => {
    if (step === 2) {
      mapInstanceRef.current = null;
      autocompleteRef.current = null;
      const timer = setTimeout(() => {
        initGoogleMap();
        initGooglePlacesAutocomplete();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      mapInstanceRef.current = null;
      autocompleteRef.current = null;
    }
  }, [step]);

  const initGooglePlacesAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places || !addressInputRef.current) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'ph' },
        fields: ['address_components', 'geometry', 'icon', 'name', 'formatted_address'],
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && (place.formatted_address || place.name)) {
          const fullAddr = place.formatted_address || place.name || '';
          setVenueAddress(fullAddr);
          validateAddressAgainstRegion(fullAddr, selectedRuleId);

          if (place.geometry?.location) {
            updateMapPosition(place.geometry.location);
          }
        }
      });
    } catch (e) {
      console.error('Google Places Autocomplete init warning:', e);
    }
  };

  const initGoogleMap = () => {
    if (!window.google || !window.google.maps || !mapContainerRef.current) return;

    try {
      const defaultCenter = { lat: 14.5547, lng: 121.0456 }; // Metro Manila / BGC default
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
      });

      const marker = new window.google.maps.Marker({
        position: defaultCenter,
        map,
        draggable: true,
        title: 'Drag or click to select venue location',
      });

      const geocoder = new window.google.maps.Geocoder();

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
      geocoderRef.current = geocoder;

      // If venueAddress is present, center map on venue address
      if (venueAddress) {
        geocoder.geocode({ address: venueAddress }, (results: any[], status: string) => {
          if (status === 'OK' && results && results[0] && results[0].geometry?.location) {
            const loc = results[0].geometry.location;
            map.setCenter(loc);
            marker.setPosition(loc);
          }
        });
      }

      map.addListener('click', (e: any) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          reverseGeocode(e.latLng);
        }
      });

      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (position) {
          reverseGeocode(position);
        }
      });
    } catch (err) {
      console.error('Error initializing Google Map:', err);
    }
  };

  const updateMapPosition = (latLng: any) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(latLng);
      mapInstanceRef.current.setZoom(16);
    }
    if (markerInstanceRef.current) {
      markerInstanceRef.current.setPosition(latLng);
    }
  };

  const reverseGeocode = (latLng: any) => {
    if (!geocoderRef.current) return;

    geocoderRef.current.geocode({ location: latLng }, (results: any[], status: string) => {
      if (status === 'OK' && results && results[0]) {
        const fullAddr = results[0].formatted_address;
        setVenueAddress(fullAddr);
        validateAddressAgainstRegion(fullAddr, selectedRuleId);
      }
    });
  };

  // ── 3. Address vs Selected Coverage Region Validation ─────────────────────
  const validateAddressAgainstRegion = (addr: string, ruleId: string) => {
    const rule = transportRules.find((r) => r.id === ruleId);
    if (!rule || !addr.trim()) {
      setIsLocationValid(true);
      setStep2Error('');
      return true;
    }

    const addrText = addr.toLowerCase();
    const regionText = rule.region.toLowerCase();

    // Extract keywords from region string
    const keywords = regionText
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && w !== 'region');

    // Add common NCR city keywords
    if (regionText.includes('ncr') || regionText.includes('metro manila')) {
      keywords.push('manila', 'quezon', 'taguig', 'bgc', 'makati', 'pasig', 'mandaluyong', 'paranaque', 'las pinas', 'muntinlupa', 'marikina', 'pasay', 'malabon', 'navotas', 'valenzuela', 'san juan');
    }

    const matches = keywords.some((kw) => addrText.includes(kw));

    if (!matches && keywords.length > 0) {
      setIsLocationValid(false);
      setStep2Error(
        `Notice: Selected venue location does not match your chosen coverage region "${rule.region}". Please pick a venue location within ${rule.region} or change your coverage region.`
      );
      return false;
    }

    setIsLocationValid(true);
    setStep2Error('');
    return true;
  };

  // ── Prefill User Profile ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfileLoading(false);
          return;
        }

        setUserId(user.id);
        if (user.email) setEmail(user.email);

        const meta = user.user_metadata || {};
        if (meta.first_name) setFirstName(meta.first_name);
        if (meta.last_name) setLastName(meta.last_name);
        if (meta.phone) setPhoneDigits(parseDigits(meta.phone));

        // Fetch public.profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.first_name) setFirstName(profile.first_name);
          if (profile.last_name) setLastName(profile.last_name);
          if (profile.email) setEmail(profile.email);
          if (profile.phone) setPhoneDigits(parseDigits(profile.phone));
          if (profile.is_phone_verified !== undefined) {
            setIsPhoneVerified(profile.is_phone_verified);
          }
        }
      } catch (err) {
        console.error('Error fetching user profile for checkout:', err);
      } finally {
        setProfileLoading(false);
      }
    }

    loadUserProfile();

    // Re-fetch automatically whenever user switches back to this tab
    const handleFocus = () => {
      loadUserProfile();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // ── Phone Verification Callback ───────────────────────────────────────────
  const handleConfirmPhoneVerification = async () => {
    setPhoneModalError('');
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
      setPhoneModalError('Mobile phone number must be a valid 10-digit PH number starting with 9 (e.g. 9171234567).');
      return;
    }

    setVerifyingPhone(true);
    const formattedPhone = `${countryCode} ${phoneDigits}`;

    try {
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          phone: formattedPhone,
          is_phone_verified: true,
          updated_at: new Date().toISOString(),
        });

        await supabase.auth.updateUser({
          data: { phone: formattedPhone },
        });
      }

      setIsPhoneVerified(true);
      setShowPhoneModal(false);
      setPhoneOtpToken('');
      setStep1Error('');
      setPhoneModalError('');
    } catch (err) {
      console.error('Failed to verify phone:', err);
      setPhoneModalError('Failed to update phone verification status in database.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  // ── Real-time Live Availability Check Helper ────────────────────────────────
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

  // ── Step 1 Handler ────────────────────────────────────────────────────────
  const handleNextStep1 = async () => {
    setStep1Error('');

    if (!firstName.trim() || !lastName.trim()) {
      setStep1Error('First name and last name are required.');
      return;
    }
    if (!email.trim()) {
      setStep1Error('Email address is required.');
      return;
    }
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
      setStep1Error('Mobile phone number is required and must be 10 digits starting with 9 (e.g. 9171234567).');
      return;
    }
    if (!isPhoneVerified) {
      setStep1Error('Mobile phone number MUST be verified before proceeding with your booking.');
      return;
    }
    if (!eventDate) {
      setStep1Error('Please select your event date.');
      return;
    }
    if (isPastDate(eventDate)) {
      setStep1Error('The selected event date is in the past. Please choose a future date.');
      return;
    }

    // Real-time live database double check
    const isAvailable = await checkLiveAvailability(eventDate);
    if (!isAvailable) {
      setStep1Error(`Conflict: Another customer just completed a booking for ${eventDate}. Please choose a different available date.`);
      return;
    }

    if (!eventDescription.trim()) {
      setStep1Error('Please fill out "Tell Me About Your Event" (required).');
      return;
    }

    setStep(2);
  };

  // ── Step 2 Handler ────────────────────────────────────────────────────────
  const handleNextStep2 = async () => {
    setStep2Error('');
    if (!venueAddress.trim()) {
      setStep2Error('Please enter your venue name and full address.');
      return;
    }

    const isValid = validateAddressAgainstRegion(venueAddress, selectedRuleId);
    if (!isValid) return;

    // Real-time live database double check
    const isAvailable = await checkLiveAvailability(eventDate);
    if (!isAvailable) {
      setStep2Error(`Conflict: Another customer just completed a booking for ${eventDate} while you were entering logistics. Please choose another date.`);
      return;
    }

    setStep(3);
  };

  const [paymongoLoading, setPaymongoLoading] = useState(false);

  // ── Step 3 PayMongo Checkout Payment Handler ───────────────────────────────
  const handlePaymongoPayment = async () => {
    setStep3Error('');
    setPaymongoLoading(true);

    // Real-time live database double check before launching PayMongo Checkout
    const isAvailable = await checkLiveAvailability(eventDate);
    if (!isAvailable) {
      setStep3Error(`Conflict: Another customer just completed a booking for ${eventDate} right before checkout. Payment halted. Please select another date.`);
      setPaymongoLoading(false);
      return;
    }

    try {
      const refNum = `BNH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const baseUrl = `${window.location.origin}${window.location.pathname}`;

      const selectedRule = transportRules.find((r) => r.id === selectedRuleId);
      const fee = selectedRule ? selectedRule.baseFee : 0;

      const currentAddonsCost = selectedAddons.reduce((acc, addonStr) => {
        const match = String(addonStr).match(/₱([\d,]+)/);
        if (match) {
          return acc + parseInt(match[1].replace(/,/g, ''), 10);
        }
        return acc;
      }, 0);

      const currentPkgPrice = (pkg as any)?.rawPrice ?? (pkg as any)?.raw_price ?? (pkg?.price ? parseInt(String(pkg.price).replace(/[^\d]/g, ''), 10) || 0 : 0);

      const calculatedTotalCost = currentPkgPrice + currentAddonsCost + fee;
      const calculatedDepositRequired = Math.round(calculatedTotalCost * 0.5);

      const params = {
        amount: calculatedDepositRequired,
        itemDesc: `50% Deposit - ${pkg.name}`,
        referenceNumber: refNum,
        buyer: {
          firstName: firstName || 'Valued',
          lastName: lastName || 'Customer',
          email: email || 'customer@binhiconcept.ph',
          phone: `${countryCode} ${phoneDigits}`,
        },
        redirectUrl: {
          success: `${baseUrl}?page=payment-success&ref=${refNum}`,
          failure: `${baseUrl}?page=payment-failure&ref=${refNum}`,
          cancel: `${baseUrl}?page=payment-cancel&ref=${refNum}`,
        },
      };

      // Save pending booking record into Supabase database bookings table
      try {
        await supabase.from('bookings').insert({
          package_id: pkg.id,
          package_name: pkg.name,
          package_price: currentPkgPrice,
          addons_cost: currentAddonsCost,
          event_type: eventType,
          event_date: eventDate,
          event_description: eventDescription,
          venue_address: venueAddress,
          region_rule_id: selectedRuleId,
          transport_fee: fee,
          total_cost: calculatedTotalCost,
          deposit_amount: calculatedDepositRequired,
          payment_status: 'pending',
          paymongo_reference_number: refNum,
          customer_name: `${firstName} ${lastName}`.trim() || 'Valued Customer',
          customer_email: email || '',
          customer_phone: phoneDigits ? `+63 ${phoneDigits}` : '',
          guest_count: 100,
          selected_addons: selectedAddons,
        });
      } catch (dbErr) {
        console.warn('Database booking insert warning:', dbErr);
      }

      const result = await createPaymongoCheckoutSession(params);
      if (result && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        throw new Error('No checkout_url returned from Edge Function create-checkout-session.');
      }
    } catch (err: any) {
      console.error('PayMongo payment error:', err);
      setStep3Error(err?.message || 'Failed to initiate PayMongo Checkout session. Please try again.');
      setPaymongoLoading(false);
    }
  };

  // ── Step 3 Submit Booking Handler ──────────────────────────────────────────
  const handleSubmitBooking = () => {
    setStep3Error('');
    if (!receiptUploaded) {
      setStep3Error('Please upload your deposit payment slip before completing your booking.');
      return;
    }

    setBookingSuccessModal(true);
  };

  // ── Costs calculations ────────────────────────────────────────────────────
  const currentSelectedRule = transportRules.find((r) => r.id === selectedRuleId) || transportRules[0];
  const transportFee = currentSelectedRule ? currentSelectedRule.baseFee : 1500;
  const locationRegionName = currentSelectedRule ? currentSelectedRule.region : 'Selected Location';

  // Real add-on cost calculation from selected equipment items
  const addonsCost = selectedAddons.reduce((sum, itemStr) => {
    const match = String(itemStr).match(/₱([\d,]+)/);
    if (match && match[1]) {
      const val = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) return sum + val;
    }
    return sum;
  }, 0);

  const parsedPackagePrice = (pkg as any)?.rawPrice ?? (pkg as any)?.raw_price ?? (pkg?.price ? parseInt(String(pkg.price).replace(/[^\d]/g, ''), 10) || 0 : 0);

  const packageAndAddonPrice = parsedPackagePrice + addonsCost;
  const totalCost = packageAndAddonPrice + transportFee;
  const depositRequired = Math.round(totalCost * 0.5);

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-3xl mx-auto">
        {/* Boutique Split-Card Step Progress Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => go('package-detail')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors group cursor-pointer"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back to package details
            </button>
            <div className="text-right">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#24252c]/50 block">Booking Summary</span>
              <span className="text-xs sm:text-sm font-extrabold text-[var(--ink)]">
                {pkg.name} · <span className="text-[#1090F8]">₱{(step === 1 ? packageAndAddonPrice : totalCost).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {[
              { num: '01', title: 'Contact & Event', desc: 'Who & When', s: 1 },
              { num: '02', title: 'Venue & Logistics', desc: 'Location Fee', s: 2 },
              { num: '03', title: '50% Deposit', desc: 'Slip Upload', s: 3 },
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
                      ? 'bg-[#161823] text-white border-[#161823] shadow-lg scale-[1.02]'
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

        {/* ── STEP 1: Contact & Event ── */}
        {step === 1 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 1: Your Contact & Event Info</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Prefilled from your customer profile. Phone verification is required to proceed.</p>
            </div>

            {/* Step 1 Price Breakdown (Package + Add-ons ONLY) */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[var(--ink)] block">{pkg.name}</span>
                  <span className="text-[#24252c]/50 text-[11px]">Standard Package Base Rate</span>
                </div>
                <span className="font-bold text-[var(--ink)]">₱{(Number(pkg.rawPrice) || 33500).toLocaleString()}</span>
              </div>

              {selectedAddons.length > 0 ? (
                <div className="pt-2 border-t border-[#24252c]/[0.06] space-y-1.5">
                  <span className="text-[10px] font-extrabold text-[#1090F8] uppercase tracking-wider block">
                    Selected Optional Equipment Add-ons ({selectedAddons.length})
                  </span>
                  {selectedAddons.map((addonStr, idx) => (
                    <div key={idx} className="flex justify-between text-[#24252c]/80 text-[11px] font-medium pl-1">
                      <span>• {addonStr}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pt-1.5 text-[11px] text-[#24252c]/50">
                  No optional equipment add-ons selected.
                </div>
              )}

              <div className="pt-2 border-t border-[#24252c]/[0.08] flex items-center justify-between">
                <span className="font-extrabold text-[var(--ink)]">Package & Add-ons Price</span>
                <span className="text-base font-extrabold text-[#1090F8]">₱{packageAndAddonPrice.toLocaleString()}</span>
              </div>
            </div>

            {step1Error && (
              <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {step1Error}
              </div>
            )}

            {/* Name Fields (Readonly when prefilled) */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={firstName}
                  readOnly={Boolean(firstName)}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium ${
                    firstName ? 'cursor-not-allowed opacity-90' : ''
                  }`}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={lastName}
                  readOnly={Boolean(lastName)}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium ${
                    lastName ? 'cursor-not-allowed opacity-90' : ''
                  }`}
                  required
                />
              </div>
            </div>

            {/* Email & Phone Fields */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Email Field (Unchangeable) */}
              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    Verified Account
                  </span>
                </div>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium cursor-not-allowed opacity-90"
                  required
                />
              </div>

              {/* Mobile Phone Number (Country Code + 10 digits + Verification) */}
              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                    Mobile Phone Number <span className="text-rose-500">*</span>
                  </label>
                  {profileLoading ? (
                    <span className="text-[10px] font-semibold text-[#1090F8] bg-[#1090F8]/10 border border-[#1090F8]/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8] animate-ping" />
                      Checking verification...
                    </span>
                  ) : isPhoneVerified ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
                          setStep1Error('Please enter a valid 10-digit mobile number starting with 9 (e.g. 9171234567) before verifying.');
                          return;
                        }
                        setPhoneModalError('');
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
                    className={`w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium ${
                      isPhoneVerified ? 'cursor-not-allowed opacity-90' : 'focus:outline-none focus:border-[#1090F8]'
                    }`}
                    required
                  />
                </div>
                {phoneDigits.length > 0 && (phoneDigits.length < 10 || !phoneDigits.startsWith('9')) && (
                  <p className="text-[10px] text-rose-500 font-semibold ml-2 mt-1">
                    Must be 10 digits starting with 9 (e.g. 9171234567).
                  </p>
                )}
                <p className="text-[11px] text-[#24252c]/50 mt-1 ml-2">
                  Need to change phone?{' '}
                  <a
                    href="?page=profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(window.location.origin + window.location.pathname + '?page=profile', '_blank');
                    }}
                    className="font-bold text-[#1090F8] hover:underline cursor-pointer"
                  >
                    Edit in profile
                  </a>
                </p>
              </div>
            </div>

            {/* Event Format & Event Date */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Event Format <span className="text-rose-500">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8]"
                  required
                >
                  <option value="Birthday / Debut Celebration">Birthday / Debut Celebration</option>
                  <option value="Wedding / Engagement Reception">Wedding / Engagement Reception</option>
                  <option value="Corporate Event / Gala / Launch">Corporate Event / Gala / Launch</option>
                  <option value="Concert / Music Festival">Concert / Music Festival</option>
                  <option value="Private Party / Social Gathering">Private Party / Social Gathering</option>
                  <option value="Anniversary / Alumni Homecoming">Anniversary / Alumni Homecoming</option>
                  <option value="Other Special Event">Other Special Event</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Event Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    localStorage.setItem('binhi_selected_event_date', e.target.value);
                  }}
                  className={`w-full rounded-full border px-4 py-3 text-sm font-semibold focus:outline-none ${
                    isPastDate(eventDate) || dbBookings.some((b) => b.event_date === eventDate)
                      ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                      : 'border-transparent bg-[var(--mist)] text-[var(--ink)] focus:border-[#1090F8]'
                  }`}
                  required
                />
                {(isPastDate(eventDate) || dbBookings.some((b) => b.event_date === eventDate)) && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    {isPastDate(eventDate)
                      ? 'Past Date: Please choose a future event date.'
                      : 'Reserved Date: This date is already booked in database. Please select an available date.'}
                  </p>
                )}
              </div>
            </div>

            {/* Tell Me About Your Event (Required Textarea) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Tell Me About Your Event <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Tell us about your event schedule, venue layout, acoustic expectations, music preferences, or special staging requests..."
                className="w-full rounded-2xl border border-transparent p-4 text-sm bg-[var(--mist)] text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
              />
            </div>

            <button
              type="button"
              onClick={handleNextStep1}
              className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              Next: Logistics & Transport Fee →
            </button>
          </div>
        )}

        {/* ── STEP 2: Logistics ── */}
        {step === 2 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 2: Venue Logistics & Location Picker</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Specify venue location via search or Google Map pin to calculate crew transport fee.</p>
            </div>

            {step2Error && (
              <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {step2Error}
              </div>
            )}

            {/* Venue Location Region Select (Fetched from DB transport_rules) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Venue Coverage Region <span className="text-rose-500">*</span>
              </label>
              {transportLoading ? (
                <div className="h-12 bg-white/60 rounded-full animate-pulse border border-[#24252c]/10" />
              ) : (
                <select
                  value={selectedRuleId}
                  onChange={(e) => {
                    setSelectedRuleId(e.target.value);
                    validateAddressAgainstRegion(venueAddress, e.target.value);
                  }}
                  className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8] cursor-pointer"
                >
                  {transportRules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.region} — +₱{r.baseFee.toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Venue Name & Full Address (Google Places Autocomplete Input) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Venue Name & Full Address <span className="text-rose-500">*</span>
              </label>
              <input
                ref={addressInputRef}
                value={venueAddress}
                onChange={(e) => {
                  setVenueAddress(e.target.value);
                  validateAddressAgainstRegion(e.target.value, selectedRuleId);
                }}
                placeholder="Search venue or address (e.g. Shangri-La Fort, BGC)"
                className={`w-full rounded-full border px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none ${
                  !isLocationValid ? 'border-rose-300 bg-rose-50/30' : 'border-transparent focus:border-[#1090F8]'
                }`}
                required
              />
              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-2">
                Address must be located within your selected coverage region ({locationRegionName}).
              </p>
            </div>

            {/* Interactive Google Map Location Picker */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
                Choose Location on Google Map
              </label>
              <div
                ref={mapContainerRef}
                className="w-full h-64 rounded-2xl border border-[#24252c]/10 overflow-hidden bg-[var(--mist)] shadow-inner"
              />
              <p className="text-[10px] text-[#24252c]/50 mt-1.5 ml-1">
                Tip: Click anywhere on the map or drag the pin marker to select your exact venue location.
              </p>
            </div>

            {/* Cost Summary Box (Package & Add-ons + Transpo Fee = Total) */}
            <div className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5 text-xs">
              <div className="flex justify-between text-[#24252c]/60">
                <span>Package & Add-ons Subtotal</span>
                <span className="font-bold text-[var(--ink)]">₱{packageAndAddonPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60">
                <span>Transport & Logistics Charge ({locationRegionName})</span>
                <span className="font-bold text-[#1090F8]">+₱{transportFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-[#24252c]/[0.08] flex justify-between items-center text-sm">
                <span className="font-extrabold text-[var(--ink)]">Total Package & Transport Cost</span>
                <span className="font-extrabold text-[var(--ink)] text-base">₱{totalCost.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10 cursor-pointer">
                ← Back
              </button>
              <button
                onClick={handleNextStep2}
                disabled={!isLocationValid || !venueAddress.trim()}
                className="w-2/3 bg-[var(--ink)] disabled:opacity-50 text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Next: Payment & Deposit →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Deposit ── */}
        {step === 3 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 3: 50% Deposit Payment</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Complete your 50% reservation deposit via PayMongo (QR Ph, GCash, Maya, Cards).</p>
            </div>

            {step3Error && (
              <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {step3Error}
              </div>
            )}

            <div className="p-6 rounded-2xl bg-[#1090F8]/10 border border-[#1090F8]/20 text-center">
              <div className="text-xs font-bold text-[#1090F8] uppercase tracking-wider">Required 50% Reservation Deposit</div>
              <div className="text-3xl font-extrabold text-[#1090F8] mt-1">₱{depositRequired.toLocaleString()}</div>
            </div>



            {/* Direct PayMongo Pay Button */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handlePaymongoPayment}
                disabled={paymongoLoading}
                className="w-full bg-[var(--ink)] text-white text-sm font-bold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paymongoLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Redirecting to PayMongo Checkout...</span>
                  </>
                ) : (
                  <span>Pay ₱{depositRequired.toLocaleString()} 50% Deposit via PayMongo →</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10 cursor-pointer hover:bg-black/5 transition-colors"
              >
                ← Back to Logistics & Venue
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mock Phone Verification Modal ── */}
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
              Verification SMS code sent to <strong className="text-[var(--ink)]">+63 {phoneDigits}</strong>
            </p>
          </div>

          {phoneModalError && (
            <div className="mb-4 p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
              {phoneModalError}
            </div>
          )}

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

      {/* ── Booking Submission Confirmation Modal ── */}
      <ModalOverlay isOpen={bookingSuccessModal} onClose={() => {}}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 text-center relative">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-2">Booking Submitted!</h3>
          <p className="text-xs text-[#24252c]/60 leading-relaxed mb-6">
            Thank you for booking with BINHI Concept! Our logistics team will review your deposit receipt and update your booking status shortly.
          </p>
          <button
            onClick={() => {
              setBookingSuccessModal(false);
              go('landing');
            }}
            className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-md"
          >
            Back to Home Page
          </button>
        </div>
      </ModalOverlay>
    </section>
  );
}