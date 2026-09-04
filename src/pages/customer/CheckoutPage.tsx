import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconX, IconCheck, IconPin, IconSearch, IconArrow, IconTicket, IconChevronDown, IconChevronUp } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';
import { createPaymongoCheckoutSession } from '../../utils/paymongoPayment';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';
import { validateVoucherCode, recordVoucherUsage } from '../../utils/voucherService';
import {
  fetchLogisticsConfig,
  calculateDistanceKm,
  type LogisticsConfig,
  DEFAULT_LOGISTICS_CONFIG,
} from '../../utils/logistics';

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

  // ── Logistics & Warehouse State ───────────────────────────────────────────
  const [transportRules, setTransportRules] = useState<TransportRuleOption[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [transportLoading, setTransportLoading] = useState(true);
  const [venueAddress, setVenueAddress] = useState('');
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [selectedAddons] = useState<string[]>(initialAddons);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');

  // Warehouse origin & proximity distance state
  const [logistics, setLogistics] = useState<LogisticsConfig>(DEFAULT_LOGISTICS_CONFIG);
  const [distanceFromWarehouse, setDistanceFromWarehouse] = useState<number | null>(null);
  const warehouseMarkerRef = useRef<L.Marker | null>(null);
  const warehouseCircleRef = useRef<L.Circle | null>(null);
  const distancePolylineRef = useRef<L.Polyline | null>(null);

  // Load logistics config
  useEffect(() => {
    async function loadLogistics() {
      try {
        const config = await fetchLogisticsConfig();
        setLogistics(config);
      } catch (err) {
        console.error('Failed to load logistics config:', err);
      }
    }
    loadLogistics();
  }, []);

  // ── Promo Code State ───────────────────────────────────────────────────────
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState('');

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

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
    setPromoInput('');
  };

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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  // ── Address & Map States (Powered by Leaflet & OpenStreetMap) ──────────────
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const searchDebounceRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  // ── Regional Default Coordinates Map ─────────────────────────────────────
  const getRegionCoordinates = (ruleId: string): [number, number] => {
    const rule = transportRules.find((r) => r.id === ruleId);
    const reg = (rule?.region || '').toLowerCase();
    if (reg.includes('cavite')) return [14.2456, 120.8786];
    if (reg.includes('laguna') || reg.includes('batangas')) return [14.1708, 121.2433];
    if (reg.includes('bulacan') || reg.includes('pampanga')) return [15.0298, 120.6896];
    return [14.5547, 121.0456]; // Metro Manila / BGC default
  };

  // Helper to update distance from warehouse and draw polyline
  const updateDistanceAndLine = (lat: number, lng: number) => {
    const dist = calculateDistanceKm(lat, lng, logistics.warehouseLat, logistics.warehouseLng);
    setDistanceFromWarehouse(dist);

    if (mapInstanceRef.current) {
      if (distancePolylineRef.current) {
        distancePolylineRef.current.remove();
        distancePolylineRef.current = null;
      }
      const isFree = logistics.isFreeRadiusEnabled && dist <= logistics.freeRadiusKm;
      const poly = L.polyline(
        [
          [logistics.warehouseLat, logistics.warehouseLng],
          [lat, lng],
        ],
        {
          color: isFree ? '#10B981' : '#1090F8',
          weight: 2.5,
          dashArray: '6, 8',
          opacity: 0.85,
        }
      ).addTo(mapInstanceRef.current);
      distancePolylineRef.current = poly;
    }
  };

  // ── Reverse Geocoding with Nominatim (Lat/Lng to Address) ──────────────────
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    updateDistanceAndLine(lat, lng);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-PH, en',
          },
        }
      );
      if (!res.ok) throw new Error('Geocoding request failed');
      const data = await res.json();
      if (data && data.display_name) {
        const addrObj = data.address || {};
        const venuePart = addrObj.amenity || addrObj.building || addrObj.leisure || addrObj.shop || addrObj.office || '';
        const roadPart = addrObj.road || addrObj.pedestrian || '';
        const areaPart = addrObj.neighbourhood || addrObj.suburb || addrObj.city_district || addrObj.quarter || '';
        const cityPart = addrObj.city || addrObj.municipality || addrObj.town || '';
        const statePart = addrObj.state || addrObj.region || '';

        const composed = [venuePart, roadPart, areaPart, cityPart, statePart].filter(Boolean).join(', ');
        const finalAddress = composed.length > 8 ? composed : data.display_name;

        setVenueAddress(finalAddress);
        validateAddressAgainstRegion(finalAddress, selectedRuleId);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── 2. Initialize Leaflet Map (Step 2 Active) ──────────────────────────────
  useEffect(() => {
    if (step !== 2) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
        warehouseMarkerRef.current = null;
        warehouseCircleRef.current = null;
        distancePolylineRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
        warehouseMarkerRef.current = null;
        warehouseCircleRef.current = null;
        distancePolylineRef.current = null;
      }

      const [initialLat, initialLng] = getRegionCoordinates(selectedRuleId);

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // OpenStreetMap Official Standard Tiles (100% Free, Zero API Key, Zero Watermarks)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // 1. Warehouse Origin Pin & Free Transport Radius Circle
      const warehouseIcon = L.divIcon({
        className: 'binhi-warehouse-origin-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; transform: translate(-50%, -100%);">
            <div style="position: relative; width: 32px; height: 32px; border-radius: 9999px; background: #0c162c; border: 2.5px solid #1090F8; box-shadow: 0 8px 20px -2px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const warehouseMarker = L.marker([logistics.warehouseLat, logistics.warehouseLng], {
        icon: warehouseIcon,
      }).addTo(map);

      warehouseMarker.bindTooltip(logistics.warehouseName || 'Warehouse Facility Origin', {
        permanent: false,
        direction: 'top',
      });

      const freeCircle = L.circle([logistics.warehouseLat, logistics.warehouseLng], {
        radius: (logistics.freeRadiusKm || 2) * 1000,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: logistics.isFreeRadiusEnabled ? 0.14 : 0.03,
        weight: 1.8,
        dashArray: logistics.isFreeRadiusEnabled ? undefined : '5, 5',
      }).addTo(map);

      freeCircle.bindTooltip(`${logistics.freeRadiusKm} km Free Transport Zone`, {
        permanent: false,
        direction: 'bottom',
      });

      warehouseMarkerRef.current = warehouseMarker;
      warehouseCircleRef.current = freeCircle;

      // 2. Minimalist sleek Venue Pin Icon with pulse effect
      const pinIcon = L.divIcon({
        className: 'binhi-custom-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; transform: translate(-50%, -100%);">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background: rgba(16, 144, 248, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background: #24252c; border: 2.5px solid #ffffff; box-shadow: 0 10px 20px -3px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;

      // Initial distance calculation
      updateDistanceAndLine(initialLat, initialLng);

      // Click to place venue marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      // Drag venue marker
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });

      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
        warehouseMarkerRef.current = null;
        warehouseCircleRef.current = null;
        distancePolylineRef.current = null;
      }
    };
  }, [step, logistics]);

  // Click outside to close address suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddressDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Address Search Autocomplete (Debounced)
  const handleAddressInputChange = (val: string) => {
    setVenueAddress(val);
    validateAddressAgainstRegion(val, selectedRuleId);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!val || val.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressDropdown(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=ph&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en-PH, en',
            },
          }
        );
        if (res.ok) {
          const items = await res.json();
          setAddressSuggestions(items || []);
          setShowAddressDropdown(Boolean(items && items.length > 0));
        }
      } catch (e) {
        console.error('Address search error:', e);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 400);
  };

  // Select suggestion from dropdown
  const handleSelectSuggestion = (item: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setVenueAddress(item.display_name);
    validateAddressAgainstRegion(item.display_name, selectedRuleId);
    setShowAddressDropdown(false);
    updateDistanceAndLine(lat, lng);

    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
      markerInstanceRef.current.setLatLng([lat, lng]);
    }
  };

  // Re-center when coverage region changes
  const handleRegionChange = (newRuleId: string) => {
    setSelectedRuleId(newRuleId);
    validateAddressAgainstRegion(venueAddress, newRuleId);

    const [lat, lng] = getRegionCoordinates(newRuleId);
    updateDistanceAndLine(lat, lng);
    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 13, { duration: 1 });
      markerInstanceRef.current.setLatLng([lat, lng]);
    }
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
      const standardFee = selectedRule ? selectedRule.baseFee : 0;
      const isFreeProximity = Boolean(
        logistics.isFreeRadiusEnabled &&
        distanceFromWarehouse !== null &&
        distanceFromWarehouse <= logistics.freeRadiusKm
      );
      const fee = isFreeProximity ? 0 : standardFee;

      const currentAddonsCost = selectedAddons.reduce((acc, addonStr) => {
        const match = String(addonStr).match(/₱([\d,]+)/);
        if (match) {
          return acc + parseInt(match[1].replace(/,/g, ''), 10);
        }
        return acc;
      }, 0);

      const currentPkgPrice = (pkg as any)?.rawPrice ?? (pkg as any)?.raw_price ?? (pkg?.price ? parseInt(String(pkg.price).replace(/[^\d]/g, ''), 10) || 0 : 0);

      const subtotalBeforeDiscount = currentPkgPrice + currentAddonsCost + fee;
      let currentDiscount = 0;
      if (appliedPromo) {
        if (appliedPromo.discountType === 'percentage') {
          currentDiscount = Math.round((subtotalBeforeDiscount * appliedPromo.discountValue) / 100);
        } else {
          currentDiscount = Math.min(appliedPromo.discountValue, subtotalBeforeDiscount);
        }
      }

      const calculatedTotalCost = Math.max(0, subtotalBeforeDiscount - currentDiscount);
      const calculatedDepositRequired = Math.round(calculatedTotalCost * 0.5);
      const isFull = paymentType === 'full';
      const calculatedPayAmount = isFull ? calculatedTotalCost : calculatedDepositRequired;
      const calculatedRemainingBalance = isFull ? 0 : calculatedTotalCost - calculatedDepositRequired;

      const promoSuffix = appliedPromo ? ` [Promo: ${appliedPromo.code} -₱${currentDiscount.toLocaleString()}]` : '';

      const params = {
        amount: calculatedPayAmount,
        itemDesc: isFull
          ? `Full Payment (100%) - ${pkg.name}${promoSuffix}`
          : `50% Downpayment - ${pkg.name}${promoSuffix}`,
        referenceNumber: refNum,
        buyer: {
          firstName: firstName || 'Valued',
          lastName: lastName || 'Customer',
          email: email || 'customer@binhiconcept.ph',
          phone: phoneDigits.trim(),
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
          user_id: userId || null,
          package_id: pkg.id,
          package_name: pkg.name,
          package_price: currentPkgPrice,
          addons_cost: currentAddonsCost,
          event_type: eventType,
          event_date: eventDate,
          event_description: appliedPromo
            ? `${eventDescription}\n[Promo Code: ${appliedPromo.code} (-₱${currentDiscount.toLocaleString()})]`
            : eventDescription,
          venue_address: venueAddress,
          region_rule_id: selectedRuleId,
          transport_fee: fee,
          total_cost: calculatedTotalCost,
          deposit_amount: calculatedPayAmount,
          is_fully_paid: isFull,
          remaining_balance: calculatedRemainingBalance,
          payment_status: 'pending',
          paymongo_reference_number: refNum,
          customer_name: `${firstName} ${lastName}`.trim() || 'Valued Customer',
          customer_email: email || '',
          customer_phone: phoneDigits ? `+63 ${phoneDigits}` : '',
          guest_count: 100,
          selected_addons: selectedAddons,
        });

        // Record 1 usage for the applied voucher code
        if (appliedPromo?.code) {
          try {
            await recordVoucherUsage(appliedPromo.code);
          } catch (vErr) {
            console.warn('Note recording voucher usage:', vErr);
          }
        }
      } catch (dbErr) {
        console.warn('Database booking insert warning:', dbErr);
      }

      const result = await createPaymongoCheckoutSession(params);
      if (result && result.checkout_url) {
        if (result.checkout_id) {
          try {
            localStorage.setItem('binhi_paymongo_cs_id', result.checkout_id);
            localStorage.setItem(`binhi_cs_${refNum}`, result.checkout_id);
          } catch { }
        }
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

  // ── Costs calculations & Proximity Distance Waiver ─────────────────────────
  const currentSelectedRule = transportRules.find((r) => r.id === selectedRuleId) || transportRules[0];
  const standardRegionalFee = currentSelectedRule ? currentSelectedRule.baseFee : 1500;
  const isFreeTransportApplied = Boolean(
    logistics.isFreeRadiusEnabled &&
    distanceFromWarehouse !== null &&
    distanceFromWarehouse <= logistics.freeRadiusKm
  );
  const transportFee = isFreeTransportApplied ? 0 : standardRegionalFee;
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
              { num: '03', title: 'Payment Plan', desc: paymentType === 'full' ? '100% Full Payment' : '50% Downpayment', s: 3 },
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
              <span>Next: Logistics & Transport Fee</span>
              <IconArrow className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Logistics ── */}
        {step === 2 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 2: Venue Logistics & Address</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Specify your venue location and region to calculate crew transport fee.</p>
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
                  onChange={(e) => handleRegionChange(e.target.value)}
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

            {/* Venue Name & Full Address Input with Live Suggestions Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between ml-1 mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                  Venue Name & Full Address <span className="text-rose-500">*</span>
                </label>
                {isSearchingAddress && (
                  <span className="text-[10px] font-medium text-[#1090F8] flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
                    Searching address...
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  value={venueAddress}
                  onChange={(e) => handleAddressInputChange(e.target.value)}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowAddressDropdown(true);
                  }}
                  placeholder="Type venue name or landmark (e.g. Shangri-La The Fort, BGC, Taguig)"
                  className={`w-full rounded-full border pl-11 pr-10 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none ${
                    !isLocationValid ? 'border-rose-300 bg-rose-50/30' : 'border-transparent focus:border-[#1090F8]'
                  }`}
                  required
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#24252c]/40 pointer-events-none">
                  <IconSearch className="w-4 h-4" />
                </div>
                {venueAddress && (
                  <button
                    type="button"
                    onClick={() => {
                      setVenueAddress('');
                      setShowAddressDropdown(false);
                      setAddressSuggestions([]);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#24252c]/40 hover:text-[var(--ink)] p-1 cursor-pointer"
                  >
                    <IconX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showAddressDropdown && addressSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-[#24252c]/10 shadow-2xl overflow-hidden z-[999] animate-blur-in">
                  <div className="p-2 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-[#24252c]/40 uppercase tracking-wider">
                      Suggested Locations (Philippines)
                    </div>
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--mist)] flex items-start gap-2.5 transition-colors cursor-pointer group"
                      >
                        <div className="mt-0.5 text-[#1090F8] shrink-0">
                          <IconPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--ink)] truncate group-hover:text-[#1090F8]">
                            {item.display_name.split(',')[0]}
                          </p>
                          <p className="text-[11px] text-[#24252c]/60 truncate">
                            {item.display_name.split(',').slice(1).join(', ').trim()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-2">
                Address must be located within your selected coverage region ({locationRegionName}).
              </p>
            </div>

            {/* Interactive Leaflet Map Location Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                  Venue Location Map
                </label>
                {isGeocoding ? (
                  <span className="text-[10px] font-semibold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                    <span className="w-3 h-3 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
                    Updating address from pin...
                  </span>
                ) : venueAddress ? (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <IconCheck className="w-3 h-3" />
                    Pin Location Synced
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-[#24252c]/50">
                    Click map or drag pin
                  </span>
                )}
              </div>

              <div className="relative rounded-3xl overflow-hidden border border-[#24252c]/10 shadow-sm bg-[var(--mist)]">
                <div
                  ref={mapContainerRef}
                  className="w-full h-72 z-0"
                  style={{ minHeight: '280px' }}
                />
              </div>

              {/* Helper Note Below Map */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs text-[#24252c]/75">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center shrink-0">
                    <IconPin className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium">
                    Click anywhere on the map or drag the pin to select your venue.
                  </span>
                </div>
                {distanceFromWarehouse !== null && (
                  <span className="text-[11px] font-bold text-[var(--ink)] bg-white px-2.5 py-1 rounded-full border border-black/10 shrink-0">
                    {distanceFromWarehouse} km from warehouse
                  </span>
                )}
              </div>
            </div>

            {/* Warehouse Proximity & Free Transport Alert Banner */}
            {distanceFromWarehouse !== null && (
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                  isFreeTransportApplied
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-blue-50/60 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      isFreeTransportApplied
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-[#1090F8] text-white shadow-sm'
                    }`}
                  >
                    {isFreeTransportApplied ? <IconCheck className="w-4 h-4" /> : <IconPin className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm flex items-center gap-2">
                      {isFreeTransportApplied ? (
                        <span>Free Transport Waiver Applied</span>
                      ) : (
                        <span>Delivery Distance: {distanceFromWarehouse} km</span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                      {isFreeTransportApplied
                        ? `Venue is within ${logistics.freeRadiusKm} km of our central warehouse (${distanceFromWarehouse} km away). Transport fee is waived (₱0 instead of ₱${standardRegionalFee.toLocaleString()}).`
                        : `Venue is ${distanceFromWarehouse} km away (outside the ${logistics.freeRadiusKm} km free local zone). Standard regional rate applies.`}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span
                    className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block ${
                      isFreeTransportApplied
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-blue-100 text-blue-900 border border-blue-200'
                    }`}
                  >
                    {isFreeTransportApplied ? '₱0.00 WAIVED' : `+₱${standardRegionalFee.toLocaleString()}`}
                  </span>
                </div>
              </div>
            )}

            {/* Cost Summary Box (Package & Add-ons + Transpo Fee = Total) */}
            <div className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5 text-xs">
              <div className="flex justify-between text-[#24252c]/60">
                <span>Package & Add-ons Subtotal</span>
                <span className="font-bold text-[var(--ink)]">₱{packageAndAddonPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60">
                <span>Transport & Logistics ({locationRegionName})</span>
                {isFreeTransportApplied ? (
                  <span className="font-extrabold text-emerald-600 flex items-center gap-1.5">
                    <span className="line-through text-gray-400 font-normal text-[11px]">
                      ₱{standardRegionalFee.toLocaleString()}
                    </span>
                    <span>₱0.00 (Free &lt; {logistics.freeRadiusKm}km)</span>
                  </span>
                ) : (
                  <span className="font-bold text-[#1090F8]">+₱{transportFee.toLocaleString()}</span>
                )}
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Promo Discount ({appliedPromo?.code})</span>
                  <span>-₱{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#24252c]/[0.08] flex justify-between items-center text-sm">
                <span className="font-extrabold text-[var(--ink)]">Total Package & Transport Cost</span>
                <span className="font-extrabold text-[var(--ink)] text-base">₱{totalCost.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10 cursor-pointer flex items-center justify-center gap-2 hover:bg-black/5 transition-colors"
              >
                <span className="rotate-180 inline-flex"><IconArrow className="w-4 h-4" /></span>
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep2}
                disabled={!isLocationValid || !venueAddress.trim()}
                className="w-2/3 bg-[var(--ink)] disabled:opacity-50 text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <span>Next: Payment Option</span>
                <IconArrow className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Payment Choice & Checkout ── */}
        {step === 3 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">Select Payment Plan</h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                Choose how you would like to settle your booking reservation.
              </p>
            </div>

            {step3Error && (
              <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {step3Error}
              </div>
            )}

            {/* Payment Plan Cards */}
            <div className="grid sm:grid-cols-2 gap-3.5">
              {/* Option 1: 50% Downpayment */}
              <div
                onClick={() => setPaymentType('deposit')}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  paymentType === 'deposit'
                    ? 'border-[#1090F8] bg-[#1090F8]/[0.04] shadow-sm ring-1 ring-[#1090F8]/30'
                    : 'border-[#24252c]/10 bg-white hover:border-[#24252c]/25 hover:bg-[var(--mist)]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#1090F8]/10 text-[#1090F8]">
                      50% Deposit
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        paymentType === 'deposit' ? 'border-[#1090F8] bg-[#1090F8] text-white' : 'border-[#24252c]/30 bg-white'
                      }`}
                    >
                      {paymentType === 'deposit' && <IconCheck className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div className="text-xl font-black text-[var(--ink)]">
                    ₱{depositRequired.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-[#24252c]/50 font-medium">Payable today</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#24252c]/[0.06] flex items-center justify-between text-[11px]">
                  <span className="text-[#24252c]/60">Event Day Balance:</span>
                  <span className="font-bold text-[var(--ink)]">₱{balanceDueOnEventDate.toLocaleString()}</span>
                </div>
              </div>

              {/* Option 2: 100% Full Payment */}
              <div
                onClick={() => setPaymentType('full')}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  paymentType === 'full'
                    ? 'border-[#1090F8] bg-[#1090F8]/[0.04] shadow-sm ring-1 ring-[#1090F8]/30'
                    : 'border-[#24252c]/10 bg-white hover:border-[#24252c]/25 hover:bg-[var(--mist)]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                      Full Payment
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        paymentType === 'full' ? 'border-[#1090F8] bg-[#1090F8] text-white' : 'border-[#24252c]/30 bg-white'
                      }`}
                    >
                      {paymentType === 'full' && <IconCheck className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div className="text-xl font-black text-[var(--ink)]">
                    ₱{totalCost.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-[#24252c]/50 font-medium">Payable today</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#24252c]/[0.06] flex items-center justify-between text-[11px]">
                  <span className="text-[#24252c]/60">Event Day Balance:</span>
                  <span className="font-bold text-emerald-600">₱0 (Fully Settled)</span>
                </div>
              </div>
            </div>

            {/* ── Collapsible Promo Code Trigger ── */}
            <div className="rounded-xl border border-[#24252c]/[0.08] bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setPromoOpen(!promoOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--mist)]/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <IconTicket className="w-4 h-4 text-[#1090F8]" />
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {appliedPromo ? (
                      <span className="text-emerald-600 font-bold">
                        Voucher Applied: {appliedPromo.code} (-₱{discountAmount.toLocaleString()})
                      </span>
                    ) : (
                      'Have a voucher code?'
                    )}
                  </span>
                </div>
                <span className="text-[#24252c]/40 text-xs">
                  {promoOpen ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {promoOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#24252c]/[0.06] bg-[var(--mist)]/30 space-y-2 animate-blur-in">
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                      <span className="text-emerald-800 font-bold">
                        {appliedPromo.code} — {appliedPromo.description}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          placeholder="Enter voucher code"
                          className="flex-1 rounded-lg border border-[#24252c]/15 px-3 py-2 text-xs bg-white text-[var(--ink)] font-mono font-bold uppercase placeholder:font-sans placeholder:font-normal focus:outline-none focus:border-[#1090F8]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyPromo();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                      {promoError && (
                        <p className="text-[11px] font-medium text-rose-600 mt-1">
                          {promoError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Itemized Booking Breakdown ── */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--mist)]/70 border border-[#24252c]/[0.06] space-y-2.5 text-xs">
              <div className="flex justify-between text-[#24252c]/70">
                <span>{pkg.name} Base Rate</span>
                <span className="font-semibold text-[var(--ink)]">₱{(Number(pkg.rawPrice) || 33500).toLocaleString()}</span>
              </div>

              {addonsCost > 0 && (
                <div className="flex justify-between text-[#24252c]/70">
                  <span>Add-ons ({selectedAddons.length})</span>
                  <span className="font-semibold text-[var(--ink)]">+₱{addonsCost.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-[#24252c]/70">
                <span>Transport ({locationRegionName})</span>
                {isFreeTransportApplied ? (
                  <span className="font-bold text-emerald-600">₱0.00 (Waived)</span>
                ) : (
                  <span className="font-semibold text-[var(--ink)]">+₱{transportFee.toLocaleString()}</span>
                )}
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Promo Discount ({appliedPromo?.code})</span>
                  <span>-₱{discountAmount.toLocaleString()}</span>
                </div>
              )}

              {/* Total & Due Today summary rows */}
              <div className="pt-2.5 border-t border-[#24252c]/10 space-y-1.5">
                <div className="flex justify-between text-xs text-[#24252c]/60">
                  <span>Total Event Cost</span>
                  <span className="font-bold text-[var(--ink)]">₱{totalCost.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-sm font-extrabold text-[var(--ink)]">Amount Due Today</span>
                  <span className="text-xl sm:text-2xl font-black text-[#1090F8]">₱{amountDueToday.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-[11px] text-[#24252c]/50 pt-0.5">
                  <span>Balance Due on Event Date</span>
                  <span className={paymentType === 'full' ? 'font-bold text-emerald-600' : 'font-semibold text-[var(--ink)]'}>
                    {paymentType === 'full' ? '₱0 (Fully Settled)' : `₱${remainingBalanceAmount.toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct PayMongo Pay Button */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handlePaymongoPayment}
                disabled={paymongoLoading}
                className="w-full bg-[var(--ink)] text-white text-sm font-bold py-3.5 sm:py-4 rounded-xl hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paymongoLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Redirecting to Checkout...</span>
                  </>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>
                      Pay ₱{amountDueToday.toLocaleString()} ({paymentType === 'full' ? 'Full Settlement' : '50% Downpayment'})
                    </span>
                    <IconArrow className="w-4 h-4" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-[var(--mist)] text-[var(--ink)] text-xs sm:text-sm font-semibold py-3 rounded-xl border border-[#24252c]/10 cursor-pointer hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
              >
                <span className="rotate-180 inline-flex"><IconArrow className="w-3.5 h-3.5" /></span>
                <span>Back to Logistics & Venue</span>
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