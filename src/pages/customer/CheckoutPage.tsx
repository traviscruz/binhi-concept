import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconX, IconCheck, IconPin, IconSearch, IconArrow, IconTicket, IconChevronDown, IconChevronUp, IconAlertTriangle, IconBan } from '../../components/shared/icons';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  evaluateSlotFeasibility,
  getDayAvailabilityStatus,
  formatTimeAmPm,
  calculateCrewArrivalTime,
  timeToMinutes,
  minutesToTime,
  getOperatingWindowForDate,
  type BookingSettings,
  type ScheduleOverride,
  DEFAULT_BOOKING_SETTINGS,
} from '../../utils/bookingEngine';
import { supabase } from '../../lib/supabase';
import { createPaymongoCheckoutSession } from '../../utils/paymongoPayment';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';
import { validateVoucherCode, recordVoucherUsage } from '../../utils/voucherService';
import {
  fetchLogisticsConfig,
  calculateDistanceKm,
  computeTransportFee,
  type LogisticsConfig,
  DEFAULT_LOGISTICS_CONFIG,
} from '../../utils/logistics';
import {
  validateReferralCode,
  recordAffiliateReferral,
  type AffiliatePartner,
} from '../../utils/affiliateService';
import {
  CrossSellPromotions,
  type CrossSellBundle,
} from '../../components/shared/CrossSellPromotions';

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
  const isCustomPackage = packageId === 'custom-package' || packageId === 'custom';
  const customPkgFallback: PackageData = {
    id: 'custom-package',
    name: 'Custom Tailored Package',
    tag: 'Custom Setup',
    price: 'Custom Pricing',
    rawPrice: 0,
    desc: 'Bespoke event sound, lighting, and stage production setup tailored by client.',
    img: '',
    photos: [],
    inclusions: ['Client-selected sound, lighting & video gear', 'Full on-site technician & engineering crew'],
    recommendedFor: ['Custom Events', 'Tailored Celebrations'],
    specs: { setupTime: 'Flexible Setup', crewSize: 'Dedicated Production Crew' },
  };
  const pkg = isCustomPackage ? customPkgFallback : (allPackages.find((p) => p.id === packageId) || allPackages[0]);
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
  const [eventType, setEventType] = useState(() => {
    return sessionStorage.getItem('binhi_checkout_event_type') || 'Birthday / Debut Celebration';
  });
  const [eventDate, setEventDate] = useState(() => {
    const saved = localStorage.getItem('binhi_selected_event_date');
    return saved ? formatIsoDate(saved) : formatIsoDate(initialDate);
  });
  const [startTime, setStartTime] = useState(() => localStorage.getItem('binhi_selected_start_time') || '14:00');
  const [endTime, setEndTime] = useState(() => localStorage.getItem('binhi_selected_end_time') || '19:00');
  const [venueCoords, setVenueCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);
  const [eventDescription, setEventDescription] = useState(() => {
    return sessionStorage.getItem('binhi_checkout_event_desc') || '';
  });
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  useEffect(() => {
    async function loadEngineData() {
      // 1. Fetch live operating hours and rules from public.booking_settings
      try {
        const settings = await fetchBookingSettings();
        if (settings) {
          setBookingSettings(settings);
        }
      } catch (err) {
        console.warn('Failed loading booking_settings:', err);
      }

      // 2. Fetch bookings and schedule overrides
      try {
        const [data, overrides] = await Promise.all([
          fetchDbBookedDates(),
          fetchScheduleOverrides(),
        ]);
        setDbBookings(data);
        setScheduleOverrides(overrides);
      } catch (e) {
        console.warn('Failed loading engine data:', e);
      }
    }
    loadEngineData();
  }, []);

  // ── Operating Hours Resolution & Auto-Constraint ──────────────────────────
  const opWindow = useMemo(() => {
    const res = getOperatingWindowForDate(eventDate, bookingSettings, scheduleOverrides);
    const openTime = res.openTime || '08:00';
    const closeTime = res.closeTime === '00:00' && res.isOpen ? '23:59' : (res.closeTime || '23:00');
    return {
      ...res,
      openTime,
      closeTime,
    };
  }, [eventDate, bookingSettings, scheduleOverrides]);

  // Synchronize start and end times to stay strictly within allowed operating hours
  useEffect(() => {
    if (!opWindow.isOpen) return;
    const oMin = timeToMinutes(opWindow.openTime);
    const cMin = timeToMinutes(opWindow.closeTime);

    let curStartMin = timeToMinutes(startTime);
    let updatedStart = startTime;

    if (curStartMin < oMin || curStartMin > cMin) {
      updatedStart = opWindow.openTime;
      setStartTime(updatedStart);
      localStorage.setItem('binhi_selected_start_time', updatedStart);
      curStartMin = oMin;
    }

    const curEndMin = timeToMinutes(endTime);
    if (curEndMin > cMin || curEndMin <= curStartMin) {
      const idealEndMin = Math.min(curStartMin + 240, cMin);
      const updatedEnd = minutesToTime(idealEndMin);
      setEndTime(updatedEnd);
      localStorage.setItem('binhi_selected_end_time', updatedEnd);
    }
  }, [opWindow]);

  // ── Logistics & Warehouse State ───────────────────────────────────────────
  const [transportRules, setTransportRules] = useState<TransportRuleOption[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [transportLoading, setTransportLoading] = useState(true);
  const [venueAddress, setVenueAddress] = useState('');
  const [isLocationValid, setIsLocationValid] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(initialAddons);
  const [selectedBundles, setSelectedBundles] = useState<CrossSellBundle[]>([]);
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

  // ── Dual Stackable Promo & Affiliate Partner State ──────────────────────────
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null>(null);
  const [appliedAffiliate, setAppliedAffiliate] = useState<AffiliatePartner | null>(null);
  const [promoError, setPromoError] = useState('');
  const [affiliateNotice, setAffiliateNotice] = useState<string>('');

  // Auto-detect referral code from URL query parameter ?ref=... or sessionStorage
  useEffect(() => {
    async function autoApplyReferral() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const queryRef = urlParams.get('ref');
        const storedRef = sessionStorage.getItem('binhi_ref_code');
        const codeToTry = (queryRef || storedRef || '').trim().toUpperCase();

        if (codeToTry && !appliedAffiliate) {
          const partnerRes = await validateReferralCode(codeToTry);
          if (partnerRes.valid && partnerRes.affiliate) {
            const p = partnerRes.affiliate;
            const discRate = p.clientDiscountRate ?? 5;
            setAppliedAffiliate(p);
            setPromoOpen(true);
            setAffiliateNotice(`Partner referral active: ${discRate}% discount applied via ${p.partnerName} (${p.businessName || 'Event Partner'})!`);
            sessionStorage.setItem('binhi_ref_code', p.referralCode);
          }
        }
      } catch (e) {
        console.warn('Auto referral check notice:', e);
      }
    }
    autoApplyReferral();
  }, []);

  const handleApplyPromo = async () => {
    setPromoError('');
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) {
      setPromoError('Please enter a voucher or partner referral code.');
      return;
    }

    // 1. First test if it's a standard marketing voucher
    const voucherRes = await validateVoucherCode(cleaned);
    if (voucherRes.valid && voucherRes.voucher) {
      setAppliedVoucher({
        code: voucherRes.voucher.code,
        description:
          voucherRes.voucher.description ||
          `${voucherRes.voucher.discount_value}${voucherRes.voucher.discount_type === 'percentage' ? '%' : '₱'} Discount`,
        discountType: voucherRes.voucher.discount_type,
        discountValue: voucherRes.voucher.discount_value,
      });
      setPromoInput('');
      return;
    }

    // 2. If not standard voucher, test if it's an Affiliate Partner Referral Code
    const affiliateRes = await validateReferralCode(cleaned);
    if (affiliateRes.valid && affiliateRes.affiliate) {
      const p = affiliateRes.affiliate;
      const discRate = p.clientDiscountRate ?? 5;
      setAppliedAffiliate(p);
      setPromoInput('');
      setAffiliateNotice(`Partner referral active: ${discRate}% partner discount applied via ${p.partnerName}!`);
      sessionStorage.setItem('binhi_ref_code', p.referralCode);
      return;
    }

    setPromoError(voucherRes.error || affiliateRes.message || `"${cleaned}" is not a valid voucher or partner code.`);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setPromoError('');
  };

  const handleRemoveAffiliate = () => {
    setAppliedAffiliate(null);
    setPromoError('');
    setAffiliateNotice('');
    sessionStorage.removeItem('binhi_ref_code');
  };

  const handleToggleBundle = (bundle: CrossSellBundle) => {
    setSelectedBundles((prev) => {
      const exists = prev.some((b) => b.id === bundle.id);
      if (exists) {
        return prev.filter((b) => b.id !== bundle.id);
      } else {
        return [...prev, bundle];
      }
    });
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

  // Re-fetch fresh bookings when eventDate changes to guarantee real-time availability
  useEffect(() => {
    if (!eventDate) return;
    fetchDbBookedDates().then((data) => {
      if (data && data.length) setDbBookings(data);
    }).catch(() => {});
  }, [eventDate]);

  // Real-time slot feasibility evaluation right after selecting date & time
  const slotFeasibility = useMemo(() => {
    if (!eventDate || !startTime || !endTime) return null;
    if (isPastDate(eventDate)) return null;

    return evaluateSlotFeasibility({
      targetDate: eventDate,
      startTime,
      endTime,
      venueAddress: venueAddress || 'Metro Manila',
      venueCoords,
      existingBookings: dbBookings,
      settings: bookingSettings,
      overrides: scheduleOverrides,
    });
  }, [eventDate, startTime, endTime, venueAddress, venueCoords, dbBookings, bookingSettings, scheduleOverrides]);

  // Clear stale conflict errors if current selection becomes available
  useEffect(() => {
    if (slotFeasibility?.isAvailable && step1Error.startsWith('Schedule Conflict:')) {
      setStep1Error('');
    }
  }, [slotFeasibility, step1Error]);

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
    setVenueCoords({ lat, lng });
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
  const checkLiveAvailability = async (
    targetDate: string,
    start: string,
    end: string,
    addr: string,
    coords: { lat: number; lng: number } | null
  ): Promise<{ available: boolean; conflictMessage?: string }> => {
    try {
      const freshBookings = await fetchDbBookedDates();
      setDbBookings(freshBookings);

      const res = evaluateSlotFeasibility({
        targetDate,
        startTime: start,
        endTime: end,
        venueAddress: addr,
        venueCoords: coords,
        existingBookings: freshBookings,
        settings: bookingSettings,
        overrides: scheduleOverrides,
      });

      if (!res.isAvailable) {
        return {
          available: false,
          conflictMessage: res.conflicts.map((c) => c.message).join(' | '),
        };
      }
      return { available: true };
    } catch (e) {
      return { available: true };
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
    if (!startTime || !endTime) {
      setStep1Error('Please select both event start time and end time.');
      return;
    }
    if (!opWindow.isOpen) {
      setStep1Error(`System is closed for bookings on this date: ${opWindow.reason || 'Closed'}`);
      return;
    }
    if (timeToMinutes(startTime) < timeToMinutes(opWindow.openTime)) {
      setStep1Error(`Event cannot start before opening hours (${formatTimeAmPm(opWindow.openTime)}).`);
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(opWindow.closeTime)) {
      setStep1Error(`Event cannot start at or past closing hours (${formatTimeAmPm(opWindow.closeTime)}).`);
      return;
    }
    if (timeToMinutes(endTime) > timeToMinutes(opWindow.closeTime)) {
      setStep1Error(`Event cannot extend past closing hours (${formatTimeAmPm(opWindow.closeTime)}).`);
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setStep1Error('Event end time must be later than event start time.');
      return;
    }
    if (timeToMinutes(endTime) - timeToMinutes(startTime) < 60) {
      setStep1Error('Minimum event duration is 1 hour.');
      return;
    }

    // Immediate real-time check confirmation
    if (slotFeasibility && !slotFeasibility.isAvailable) {
      setStep1Error(`Schedule Conflict: ${slotFeasibility.conflicts.map((c) => c.message).join(' | ')}`);
      return;
    }

    // Real-time slot & operating hours check
    const checkResult = await checkLiveAvailability(
      eventDate,
      startTime,
      endTime,
      venueAddress || 'Metro Manila',
      venueCoords
    );

    if (!checkResult.available) {
      setStep1Error(`Schedule Conflict: ${checkResult.conflictMessage}`);
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

    // Real-time location-aware transit & turnaround check
    const checkResult = await checkLiveAvailability(
      eventDate,
      startTime,
      endTime,
      venueAddress,
      venueCoords
    );

    if (!checkResult.available) {
      setStep2Error(`Schedule Conflict: ${checkResult.conflictMessage}`);
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
    const checkResult = await checkLiveAvailability(
      eventDate,
      startTime,
      endTime,
      venueAddress,
      venueCoords
    );
    if (!checkResult.available) {
      setStep3Error(`Conflict: ${checkResult.conflictMessage || 'This time slot is no longer available. Please select another time slot or date.'}`);
      setPaymongoLoading(false);
      return;
    }

    try {
      const refNum = `BNH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const baseUrl = `${window.location.origin}${window.location.pathname}`;

      const selectedRule = transportRules.find((r) => r.id === selectedRuleId);
      const standardFee = selectedRule ? selectedRule.baseFee : 0;
      const transportCalc = computeTransportFee(distanceFromWarehouse, standardFee, logistics);
      const fee = transportCalc.fee;

      const currentAddonsCost = selectedAddons.reduce((acc, addonStr) => {
        const match = String(addonStr).match(/₱([\d,]+)/);
        if (match) {
          return acc + parseInt(match[1].replace(/,/g, ''), 10);
        }
        return acc;
      }, 0);

      const currentBundlesCost = selectedBundles.reduce((acc, b) => acc + b.bundlePrice, 0);
      const combinedAddonStrings = [
        ...selectedAddons,
        ...selectedBundles.map((b) => `Bundle: ${b.title} (₱${b.bundlePrice.toLocaleString()})`),
      ];

      const currentPkgPrice = (pkg as any)?.rawPrice ?? (pkg as any)?.raw_price ?? (pkg?.price ? parseInt(String(pkg.price).replace(/[^\d]/g, ''), 10) || 0 : 0);

      const subtotalBeforeDiscount = currentPkgPrice + currentAddonsCost + currentBundlesCost + fee;
      
      let voucherDiscountAmount = 0;
      if (appliedVoucher) {
        if (appliedVoucher.discountType === 'percentage') {
          voucherDiscountAmount = Math.round((subtotalBeforeDiscount * appliedVoucher.discountValue) / 100);
        } else {
          voucherDiscountAmount = Math.min(appliedVoucher.discountValue, subtotalBeforeDiscount);
        }
      }

      let affiliateDiscountAmount = 0;
      if (appliedAffiliate) {
        const affiliateRate = appliedAffiliate.clientDiscountRate ?? 5;
        affiliateDiscountAmount = Math.round((subtotalBeforeDiscount * affiliateRate) / 100);
      }

      const totalDiscounts = Math.min(subtotalBeforeDiscount, voucherDiscountAmount + affiliateDiscountAmount);
      const calculatedTotalCost = Math.max(0, subtotalBeforeDiscount - totalDiscounts);
      const calculatedDepositRequired = Math.round(calculatedTotalCost * 0.5);
      const isFull = paymentType === 'full';
      const calculatedPayAmount = isFull ? calculatedTotalCost : calculatedDepositRequired;
      const calculatedRemainingBalance = isFull ? 0 : calculatedTotalCost - calculatedDepositRequired;

      const promoSuffixParts: string[] = [];
      if (appliedVoucher) promoSuffixParts.push(`Voucher: ${appliedVoucher.code} (-₱${voucherDiscountAmount.toLocaleString()})`);
      if (appliedAffiliate) promoSuffixParts.push(`Partner: ${appliedAffiliate.referralCode} (-₱${affiliateDiscountAmount.toLocaleString()})`);
      const promoSuffix = promoSuffixParts.length > 0 ? ` [${promoSuffixParts.join(' + ')}]` : '';

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
        const affiliateCommission = appliedAffiliate
          ? Math.round(calculatedTotalCost * ((appliedAffiliate.commissionRate || 5) / 100))
          : 0;

        const descriptionNotes: string[] = [];
        if (eventDescription) descriptionNotes.push(eventDescription);
        if (appliedVoucher) descriptionNotes.push(`[Voucher: ${appliedVoucher.code} (-₱${voucherDiscountAmount.toLocaleString()})]`);
        if (appliedAffiliate) descriptionNotes.push(`[Affiliate Partner: ${appliedAffiliate.referralCode} - ${appliedAffiliate.partnerName} (-₱${affiliateDiscountAmount.toLocaleString()})]`);

        await supabase.from('bookings').insert({
          user_id: userId || null,
          package_id: pkg.id,
          package_name: pkg.name,
          package_price: currentPkgPrice,
          addons_cost: currentAddonsCost + currentBundlesCost,
          event_type: eventType,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          venue_lat: venueCoords?.lat || null,
          venue_lng: venueCoords?.lng || null,
          event_description: descriptionNotes.join('\n'),
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
          selected_addons: combinedAddonStrings,
          affiliate_id: appliedAffiliate?.id || null,
          affiliate_code: appliedAffiliate?.referralCode || null,
          affiliate_discount_amount: affiliateDiscountAmount,
          affiliate_commission_amount: affiliateCommission,
        });

        // Record 1 usage for the applied voucher code
        if (appliedVoucher?.code) {
          try {
            await recordVoucherUsage(appliedVoucher.code);
          } catch (vErr) {
            console.warn('Note recording voucher usage:', vErr);
          }
        }

        // Record affiliate referral tracking
        if (appliedAffiliate) {
          try {
            await recordAffiliateReferral({
              affiliateId: appliedAffiliate.id,
              bookingRef: refNum,
              clientName: `${firstName} ${lastName}`.trim() || 'Valued Customer',
              contractAmount: calculatedTotalCost,
              discountApplied: affiliateDiscountAmount,
              commissionEarned: affiliateCommission,
              packageName: pkg.name,
            });
          } catch (aErr) {
            console.warn('Note recording affiliate referral:', aErr);
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
        try {
          sessionStorage.removeItem('binhi_checkout_event_desc');
          sessionStorage.removeItem('binhi_checkout_event_type');
          localStorage.removeItem('binhi_selected_event_date');
          localStorage.removeItem('binhi_selected_start_time');
          localStorage.removeItem('binhi_selected_end_time');
        } catch { }
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

    try {
      sessionStorage.removeItem('binhi_checkout_event_desc');
      sessionStorage.removeItem('binhi_checkout_event_type');
    } catch { }

    setBookingSuccessModal(true);
  };

  // ── Costs calculations & Proximity Distance / Per-KM Rate ─────────────────
  const currentSelectedRule = transportRules.find((r) => r.id === selectedRuleId) || transportRules[0];
  const standardRegionalFee = currentSelectedRule ? currentSelectedRule.baseFee : 1500;
  const transportCalc = computeTransportFee(distanceFromWarehouse, standardRegionalFee, logistics);
  const transportFee = transportCalc.fee;
  const isFreeTransportApplied = transportCalc.isFree;
  const locationRegionName = currentSelectedRule ? currentSelectedRule.region : 'Selected Location';

  // Real add-on & bundle cost calculation
  const addonsCost = selectedAddons.reduce((sum, itemStr) => {
    const match = String(itemStr).match(/₱([\d,]+)/);
    if (match && match[1]) {
      const val = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) return sum + val;
    }
    return sum;
  }, 0);

  const bundlesCost = selectedBundles.reduce((sum, b) => sum + b.bundlePrice, 0);

  const maintenanceDeduction = Number(localStorage.getItem('binhi_package_maintenance_deduction') || 0);
  const baseRawPackagePrice = (pkg as any)?.rawPrice ?? (pkg as any)?.raw_price ?? (pkg?.price ? parseInt(String(pkg.price).replace(/[^\d]/g, ''), 10) || 0 : 0);
  const parsedPackagePrice = Math.max(0, baseRawPackagePrice - maintenanceDeduction);

  const packageAndAddonPrice = parsedPackagePrice + addonsCost + bundlesCost;
  const subtotalBeforeDiscount = packageAndAddonPrice + transportFee;

  let voucherDiscountAmount = 0;
  if (appliedVoucher) {
    if (appliedVoucher.discountType === 'percentage') {
      voucherDiscountAmount = Math.round((subtotalBeforeDiscount * appliedVoucher.discountValue) / 100);
    } else {
      voucherDiscountAmount = Math.min(appliedVoucher.discountValue, subtotalBeforeDiscount);
    }
  }

  let affiliateDiscountAmount = 0;
  if (appliedAffiliate) {
    const affiliateRate = appliedAffiliate.clientDiscountRate ?? 5;
    affiliateDiscountAmount = Math.round((subtotalBeforeDiscount * affiliateRate) / 100);
  }

  const totalDiscountAmount = Math.min(subtotalBeforeDiscount, voucherDiscountAmount + affiliateDiscountAmount);
  const totalCost = Math.max(0, subtotalBeforeDiscount - totalDiscountAmount);
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
                <span className={`font-bold ${maintenanceDeduction > 0 ? 'line-through text-[#24252c]/40' : 'text-[var(--ink)]'}`}>
                  ₱{(Number(pkg.rawPrice) || 33500).toLocaleString()}
                </span>
              </div>

              {maintenanceDeduction > 0 && (
                <div className="flex items-center justify-between text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                  <span className="font-semibold text-[11px] flex items-center gap-1.5">
                    <IconShield className="w-3 h-3 text-amber-700 inline shrink-0" />
                    <span>Maintenance / Quarantine Discount</span>
                  </span>
                  <span className="font-bold text-[11px]">-₱{maintenanceDeduction.toLocaleString()}</span>
                </div>
              )}

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

              {selectedBundles.length > 0 && (
                <div className="pt-2 border-t border-[#24252c]/[0.06] space-y-1.5">
                  <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">
                    Selected Production Upgrades ({selectedBundles.length})
                  </span>
                  {selectedBundles.map((b) => (
                    <div key={b.id} className="flex justify-between text-[#24252c]/80 text-[11px] font-medium pl-1">
                      <span>• {b.title}</span>
                      <span className="font-bold text-[var(--ink)]">+₱{b.bundlePrice.toLocaleString()}</span>
                    </div>
                  ))}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setEventType(val);
                    sessionStorage.setItem('binhi_checkout_event_type', val);
                  }}
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
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                    Event Date <span className="text-rose-500">*</span>
                  </label>
                  {eventDate && !isPastDate(eventDate) && (() => {
                    const dayStatus = getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides);
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dayStatus.badgeClass}`}>
                        {dayStatus.label}
                      </span>
                    );
                  })()}
                </div>
                <input
                  type="date"
                  value={eventDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    localStorage.setItem('binhi_selected_event_date', e.target.value);
                  }}
                  className={`w-full rounded-full border px-4 py-3 text-sm font-semibold focus:outline-none ${
                    isPastDate(eventDate) || getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides).status === 'fully_booked'
                      ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                      : 'border-transparent bg-[var(--mist)] text-[var(--ink)] focus:border-[#1090F8]'
                  }`}
                  required
                />
                {isPastDate(eventDate) ? (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    Past Date: Please choose a future event date.
                  </p>
                ) : getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides).status === 'fully_booked' ? (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    Fully Booked: All operational windows for this day are reserved. Please select another date.
                  </p>
                ) : getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides).status === 'closed' ? (
                  <p className="text-[11px] font-bold text-zinc-600 mt-1 ml-2">
                    Closed: System does not accept bookings on this date.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Event Time Slot Selection (Operating Hours & Feasibility aware) */}
            {(() => {
              const hasSlotConflict = Boolean(slotFeasibility && !slotFeasibility.isAvailable);

              const isStartBeforeOpen = opWindow.isOpen && Boolean(startTime) && timeToMinutes(startTime) < timeToMinutes(opWindow.openTime);
              const isStartAfterClose = opWindow.isOpen && Boolean(startTime) && timeToMinutes(startTime) >= timeToMinutes(opWindow.closeTime);
              const isStartOutOfRange = isStartBeforeOpen || isStartAfterClose;

              const isEndAfterClose = opWindow.isOpen && Boolean(endTime) && timeToMinutes(endTime) > timeToMinutes(opWindow.closeTime);
              const isEndBeforeStart = Boolean(startTime && endTime) && timeToMinutes(endTime) <= timeToMinutes(startTime);
              const isEndOutOfRange = isEndAfterClose || isEndBeforeStart;

              const isStartInputError = isStartOutOfRange || hasSlotConflict;
              const isEndInputError = isEndOutOfRange || hasSlotConflict;

              const quickPresetSlots = ['09:00', '13:00', '15:00', '18:00'].filter((t) => {
                if (!opWindow.isOpen) return false;
                const m = timeToMinutes(t);
                return m >= timeToMinutes(opWindow.openTime) && m <= timeToMinutes(opWindow.closeTime) - 60;
              });

              return (
                <div className="bg-[var(--mist)] rounded-2xl p-4 border border-[#24252c]/[0.06] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#24252c]/[0.08] pb-2.5">
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">Event Schedule Window (Event Proper)</h4>
                      <p className="text-[11px] text-[#24252c]/60">Select your actual event program time. Our crew arrives early for styling setup.</p>
                    </div>
                    {opWindow.isOpen ? (
                      <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-1 rounded-full self-start sm:self-auto">
                        Daily Operating Hours: {formatTimeAmPm(opWindow.openTime)} – {formatTimeAmPm(opWindow.closeTime)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                        Closed for Bookings
                      </span>
                    )}
                  </div>

                  {opWindow.isOpen && startTime && (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/90 px-3 py-2 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">Binhi Styling &amp; Setup Arrival:</span>
                        <span className="text-[11px] text-emerald-800">
                          Our production crew arrives on-site early to assemble styling before program start
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-xs text-emerald-950 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shrink-0">
                        Crew Call Time: ~{formatTimeAmPm(calculateCrewArrivalTime(startTime, bookingSettings.default_turnaround_hours))}
                      </span>
                    </div>
                  )}

                  {!opWindow.isOpen && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                      <IconBan className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{opWindow.reason || 'Bookings are not accepted on this date.'} Please select another event date above.</span>
                    </div>
                  )}

                  {/* Quick Preset Start Times (filtered to allowed operating window) */}
                  {opWindow.isOpen && quickPresetSlots.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 mr-1">
                        Quick Slots:
                      </span>
                      {quickPresetSlots.map((slot) => {
                        const isSelected = startTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setStartTime(slot);
                              localStorage.setItem('binhi_selected_start_time', slot);
                              const endMin = Math.min(timeToMinutes(slot) + 240, timeToMinutes(opWindow.closeTime));
                              const endStr = minutesToTime(endMin);
                              setEndTime(endStr);
                              localStorage.setItem('binhi_selected_end_time', endStr);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-[#1090F8] text-white border-[#1090F8] shadow-xs'
                                : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8] hover:text-[#1090F8]'
                            }`}
                          >
                            {formatTimeAmPm(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between ml-1 mb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60">
                          Event Start Time <span className="text-rose-500">*</span>
                        </label>
                        {opWindow.isOpen && (
                          <span className="text-[10px] text-[#24252c]/50 font-semibold">
                            Min: {formatTimeAmPm(opWindow.openTime)}
                          </span>
                        )}
                      </div>
                      <input
                        type="time"
                        value={startTime}
                        min={opWindow.openTime}
                        max={opWindow.closeTime}
                        disabled={!opWindow.isOpen}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartTime(val);
                          localStorage.setItem('binhi_selected_start_time', val);
                        }}
                        onBlur={() => {
                          if (!startTime || !opWindow.isOpen) return;
                          const sMin = timeToMinutes(startTime);
                          const oMin = timeToMinutes(opWindow.openTime);
                          const cMin = timeToMinutes(opWindow.closeTime);
                          if (sMin < oMin) {
                            setStartTime(opWindow.openTime);
                            localStorage.setItem('binhi_selected_start_time', opWindow.openTime);
                          } else if (sMin > cMin) {
                            setStartTime(opWindow.closeTime);
                            localStorage.setItem('binhi_selected_start_time', opWindow.closeTime);
                          }
                        }}
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs focus:outline-none transition-colors ${
                          isStartInputError
                            ? 'border-rose-400 bg-rose-50/70 text-rose-800 focus:border-rose-500'
                            : 'border-white bg-white text-[var(--ink)] focus:border-[#1090F8]'
                        } ${!opWindow.isOpen ? 'opacity-50 cursor-not-allowed bg-zinc-100' : ''}`}
                        required
                      />

                      {isStartBeforeOpen && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                          <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Blocked: Cannot start before open time ({formatTimeAmPm(opWindow.openTime)})</span>
                        </p>
                      )}
                      {isStartAfterClose && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                          <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Blocked: Cannot start at or after close time ({formatTimeAmPm(opWindow.closeTime)})</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between ml-1 mb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60">
                          Event End / Pack-up Time <span className="text-rose-500">*</span>
                        </label>
                        {opWindow.isOpen && (
                          <span className="text-[10px] text-[#24252c]/50 font-semibold">
                            Max: {formatTimeAmPm(opWindow.closeTime)}
                          </span>
                        )}
                      </div>
                      <input
                        type="time"
                        value={endTime}
                        min={startTime && timeToMinutes(startTime) >= timeToMinutes(opWindow.openTime) ? startTime : opWindow.openTime}
                        max={opWindow.closeTime}
                        disabled={!opWindow.isOpen}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEndTime(val);
                          localStorage.setItem('binhi_selected_end_time', val);
                        }}
                        onBlur={() => {
                          if (!endTime || !opWindow.isOpen) return;
                          const eMin = timeToMinutes(endTime);
                          const sMin = timeToMinutes(startTime);
                          const cMin = timeToMinutes(opWindow.closeTime);
                          if (eMin > cMin) {
                            setEndTime(opWindow.closeTime);
                            localStorage.setItem('binhi_selected_end_time', opWindow.closeTime);
                          } else if (sMin && eMin <= sMin) {
                            const fixedEnd = Math.min(sMin + 60, cMin);
                            const val = minutesToTime(fixedEnd);
                            setEndTime(val);
                            localStorage.setItem('binhi_selected_end_time', val);
                          }
                        }}
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs focus:outline-none transition-colors ${
                          isEndInputError
                            ? 'border-rose-400 bg-rose-50/70 text-rose-800 focus:border-rose-500'
                            : 'border-white bg-white text-[var(--ink)] focus:border-[#1090F8]'
                        } ${!opWindow.isOpen ? 'opacity-50 cursor-not-allowed bg-zinc-100' : ''}`}
                        required
                      />

                      {isEndAfterClose && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                          <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Blocked: Cannot extend past close time ({formatTimeAmPm(opWindow.closeTime)})</span>
                        </p>
                      )}
                      {isEndBeforeStart && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                          <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Blocked: End time must be later than start time</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Real-time Feasibility & Conflict Check Alert (shows immediately right after date/time selected) */}
                  {slotFeasibility && !slotFeasibility.isAvailable && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-2 animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h5 className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                            Schedule Conflict on Selected Date
                          </h5>
                          <div className="space-y-1 mt-1">
                            {slotFeasibility.conflicts.map((c, i) => (
                              <div key={i} className="text-xs font-medium text-rose-800 leading-snug">
                                <p>{c.message}</p>
                                {c.suggestedAvailableTime && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (c.type === 'insufficient_turnaround' && c.conflictingBooking) {
                                        const existEndStr = (c.conflictingBooking.end_time || '18:00').slice(0, 5);
                                        if (timeToMinutes(startTime) >= timeToMinutes(existEndStr)) {
                                          setStartTime(c.suggestedAvailableTime!);
                                          localStorage.setItem('binhi_selected_start_time', c.suggestedAvailableTime!);
                                          const dur = Math.max(60, timeToMinutes(endTime) - timeToMinutes(startTime));
                                          const newEnd = minutesToTime(Math.min(timeToMinutes(c.suggestedAvailableTime!) + dur, timeToMinutes(opWindow.closeTime)));
                                          setEndTime(newEnd);
                                          localStorage.setItem('binhi_selected_end_time', newEnd);
                                        } else {
                                          setEndTime(c.suggestedAvailableTime!);
                                          localStorage.setItem('binhi_selected_end_time', c.suggestedAvailableTime!);
                                        }
                                      }
                                    }}
                                    className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-[11px] font-bold text-rose-900 hover:bg-rose-100/50 cursor-pointer shadow-2xs transition-colors"
                                  >
                                    <IconArrow className="w-3.5 h-3.5 text-rose-700" />
                                    <span>Auto-adjust time to {formatTimeAmPm(c.suggestedAvailableTime)}</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {slotFeasibility && slotFeasibility.isAvailable && opWindow.isOpen && !isStartOutOfRange && !isEndOutOfRange && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                          <IconCheck className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                        <span className="font-bold text-emerald-950">
                          Selected Time Slot is Available!
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Meets required {bookingSettings.default_turnaround_hours}h rest &amp; turnaround gap
                      </span>
                    </div>
                  )}

                  {/* Dynamic Duration and Turnaround Buffer Note */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-[#24252c]/70 pt-1">
                    <span>
                      Estimated Event Duration:{' '}
                      <strong className={isStartOutOfRange || isEndOutOfRange ? 'text-rose-600' : 'text-[var(--ink)]'}>
                        {isStartOutOfRange || isEndOutOfRange
                          ? 'Invalid range (outside operating hours)'
                          : timeToMinutes(endTime) > timeToMinutes(startTime)
                          ? `${((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60).toFixed(1)} Hours`
                          : 'Invalid range'}
                      </strong>
                    </span>
                    <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Constrained to operational window ({formatTimeAmPm(opWindow.openTime)} – {formatTimeAmPm(opWindow.closeTime)})</span>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Tell Me About Your Event (Required Textarea) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Tell Me About Your Event <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={eventDescription}
                onChange={(e) => {
                  const val = e.target.value;
                  setEventDescription(val);
                  sessionStorage.setItem('binhi_checkout_event_desc', val);
                }}
                placeholder="Tell us about your event schedule, venue layout, acoustic expectations, music preferences, or special staging requests..."
                className="w-full rounded-2xl border border-transparent p-4 text-sm bg-[var(--mist)] text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
              />
            </div>

            {/* Affiliate Partner Referral Notice (if applied) */}
            {affiliateNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0">
                    <IconCheck className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span className="font-bold">{affiliateNotice}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  5% OFF APPLIED
                </span>
              </div>
            )}

            {/* Cross-Selling Upgrades (Criterion J: Production Bundles) */}
            <CrossSellPromotions
              selectedBundleIds={selectedBundles.map((b) => b.id)}
              onToggleBundle={handleToggleBundle}
            />

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
                      {r.region}
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

            {/* Warehouse Proximity & Free Transport / Per-KM Rate Alert Banner */}
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
                      ) : logistics.pricingMode === 'per_km' ? (
                        <span>Distance Transport Rate: {distanceFromWarehouse} km</span>
                      ) : (
                        <span>Delivery Distance: {distanceFromWarehouse} km</span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                      {isFreeTransportApplied
                        ? `Venue is within ${logistics.freeRadiusKm} km of our central warehouse (${distanceFromWarehouse} km away). Transport fee is waived (₱0.00).`
                        : logistics.pricingMode === 'per_km'
                        ? `Calculated at ₱${logistics.costPerKm || 80}/km based on ${distanceFromWarehouse} km distance from warehouse to venue.`
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
                    {isFreeTransportApplied
                      ? '₱0.00 WAIVED'
                      : logistics.pricingMode === 'per_km'
                      ? `+₱${transportFee.toLocaleString()} (${distanceFromWarehouse}km × ₱${logistics.costPerKm || 80})`
                      : `+₱${standardRegionalFee.toLocaleString()}`}
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
                <span>
                  Transport & Logistics{' '}
                  {logistics.pricingMode === 'per_km'
                    ? `(${distanceFromWarehouse !== null ? `${distanceFromWarehouse} km @ ₱${logistics.costPerKm || 80}/km` : `₱${logistics.costPerKm || 80}/km`})`
                    : `(${locationRegionName})`}
                </span>
                {isFreeTransportApplied ? (
                  <span className="font-extrabold text-emerald-600 flex items-center gap-1.5">
                    <span className="line-through text-gray-400 font-normal text-[11px]">
                      ₱{(logistics.pricingMode === 'per_km' ? Math.round((distanceFromWarehouse ?? 1) * (logistics.costPerKm || 80)) : standardRegionalFee).toLocaleString()}
                    </span>
                    <span>₱0.00 (Free &lt; {logistics.freeRadiusKm}km)</span>
                  </span>
                ) : (
                  <span className="font-bold text-[#1090F8]">+₱{transportFee.toLocaleString()}</span>
                )}
              </div>
              {voucherDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Voucher Discount ({appliedVoucher?.code})</span>
                  <span>-₱{voucherDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              {affiliateDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Partner Referral ({appliedAffiliate?.referralCode})</span>
                  <span>-₱{affiliateDiscountAmount.toLocaleString()}</span>
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

            {/* ── Collapsible Promo & Affiliate Referral Code Trigger (Dual / Stackable) ── */}
            <div className="rounded-xl border border-[#24252c]/[0.08] bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setPromoOpen(!promoOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--mist)]/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <IconTicket className="w-4 h-4 text-[#1090F8]" />
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {appliedVoucher && appliedAffiliate ? (
                      <span className="text-emerald-600 font-bold">
                        Voucher ({appliedVoucher.code}) + Partner ({appliedAffiliate.referralCode}) Applied (-₱{totalDiscountAmount.toLocaleString()})
                      </span>
                    ) : appliedVoucher ? (
                      <span className="text-emerald-600 font-bold">
                        Voucher Applied: {appliedVoucher.code} (-₱{voucherDiscountAmount.toLocaleString()})
                      </span>
                    ) : appliedAffiliate ? (
                      <span className="text-emerald-600 font-bold">
                        Partner Referral Active: {appliedAffiliate.referralCode} (-₱{affiliateDiscountAmount.toLocaleString()})
                      </span>
                    ) : (
                      'Have a voucher or partner / affiliate code?'
                    )}
                  </span>
                </div>
                <span className="text-[#24252c]/40 text-xs">
                  {promoOpen ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {promoOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#24252c]/[0.06] bg-[var(--mist)]/30 space-y-3 animate-blur-in">
                  {/* Applied Codes Chips */}
                  <div className="space-y-2 pt-1">
                    {appliedVoucher && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase">Voucher</span>
                          <span className="text-emerald-950 font-bold">
                            {appliedVoucher.code} ({appliedVoucher.description})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveVoucher}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-2 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {appliedAffiliate && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-blue-100 text-[#1090F8] px-2 py-0.5 rounded-md uppercase">Partner</span>
                            <span className="text-blue-950 font-bold">
                              {appliedAffiliate.referralCode} ({appliedAffiliate.clientDiscountRate ?? 5}% Discount)
                            </span>
                          </div>
                          <p className="text-[10px] text-blue-700 font-medium mt-0.5 ml-0.5">
                            Referred by {appliedAffiliate.partnerName} ({appliedAffiliate.businessName || 'Affiliate Partner'})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAffiliate}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-2 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Input Box for adding codes (can add both voucher and affiliate code) */}
                  {(!appliedVoucher || !appliedAffiliate) && (
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          placeholder={
                            !appliedVoucher && !appliedAffiliate
                              ? 'Enter voucher or partner referral code'
                              : !appliedVoucher
                              ? 'Enter voucher code to stack discount'
                              : 'Enter partner referral code to stack discount'
                          }
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
                      <p className="text-[10px] text-[#24252c]/50 mt-1.5 ml-0.5">
                        Tip: You can stack both a promotional campaign voucher AND an affiliate partner code together!
                      </p>
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
                  <span>Equipment Add-ons ({selectedAddons.length})</span>
                  <span className="font-semibold text-[var(--ink)]">+₱{addonsCost.toLocaleString()}</span>
                </div>
              )}

              {selectedBundles.length > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Production Upgrades ({selectedBundles.length})</span>
                  <span className="font-semibold">+₱{bundlesCost.toLocaleString()}</span>
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

              {voucherDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Voucher Discount ({appliedVoucher?.code})</span>
                  <span>-₱{voucherDiscountAmount.toLocaleString()}</span>
                </div>
              )}

              {affiliateDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Partner Referral Discount ({appliedAffiliate?.referralCode} · {appliedAffiliate?.partnerName})</span>
                  <span>-₱{affiliateDiscountAmount.toLocaleString()}</span>
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