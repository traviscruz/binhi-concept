import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TransportRuleOption } from './types';
import { IconCheck, IconX, IconPin, IconSearch, IconArrow } from '../../shared/icons';

interface ManualBookingStep2Props {
  selectedRuleId: string;
  setSelectedRuleId: (val: string) => void;
  transportRules: TransportRuleOption[];
  venueAddress: string;
  setVenueAddress: (val: string) => void;
  isLocationValid: boolean;
  setIsLocationValid: (val: boolean) => void;
  validateAddressAgainstRegion: (addr: string, ruleId: string) => boolean;
  packageAndAddonPrice: number;
  transportFee: number;
  locationRegionName: string;
  totalCost: number;
  error: string;
  onBack: () => void;
  onNext: () => void;
}

export function ManualBookingStep2({
  selectedRuleId,
  setSelectedRuleId,
  transportRules,
  venueAddress,
  setVenueAddress,
  isLocationValid,
  setIsLocationValid,
  validateAddressAgainstRegion,
  packageAndAddonPrice,
  transportFee,
  locationRegionName,
  totalCost,
  error,
  onBack,
  onNext,
}: ManualBookingStep2Props) {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const searchDebounceRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const getRegionCoordinates = (ruleId: string): [number, number] => {
    const rule = transportRules.find((r) => r.id === ruleId);
    const reg = (rule?.region || '').toLowerCase();
    if (reg.includes('cavite')) return [14.2456, 120.8786];
    if (reg.includes('laguna') || reg.includes('batangas')) return [14.1708, 121.2433];
    if (reg.includes('bulacan') || reg.includes('pampanga')) return [15.0298, 120.6896];
    return [14.5547, 121.0456]; // Metro Manila default
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en-PH, en' } }
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

  // Initialize Leaflet Map
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }

      const [initialLat, initialLng] = getRegionCoordinates(selectedRuleId);

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

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

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

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
      }
    };
  }, [selectedRuleId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddressDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          { headers: { 'Accept-Language': 'en-PH, en' } }
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

  const handleSelectSuggestion = (item: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setVenueAddress(item.display_name);
    validateAddressAgainstRegion(item.display_name, selectedRuleId);
    setShowAddressDropdown(false);

    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
      markerInstanceRef.current.setLatLng([lat, lng]);
    }
  };

  const handleRegionChange = (newRuleId: string) => {
    setSelectedRuleId(newRuleId);
    validateAddressAgainstRegion(venueAddress, newRuleId);

    const [lat, lng] = getRegionCoordinates(newRuleId);
    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 13, { duration: 1 });
      markerInstanceRef.current.setLatLng([lat, lng]);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 2: Venue Logistics & Address</h2>
        <p className="text-xs text-[#24252c]/60 mt-1">Specify the venue location and region to calculate crew transport fee.</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Venue Coverage Region */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
          Venue Coverage Region <span className="text-rose-500">*</span>
        </label>
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
      </div>

      {/* Venue Name & Address Input */}
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
      </div>

      {/* Leaflet Interactive Map */}
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
          ) : null}
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-[#24252c]/10 shadow-sm bg-[var(--mist)]">
          <div ref={mapContainerRef} className="w-full h-72 z-0" style={{ minHeight: '280px' }} />
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs text-[#24252c]/75">
          <div className="w-5 h-5 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center shrink-0">
            <IconPin className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-medium">
            Click anywhere on the map or drag the pin marker to select your exact venue location.
          </span>
        </div>
      </div>

      {/* Cost Summary Box */}
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
        <button
          type="button"
          onClick={onBack}
          className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10 cursor-pointer flex items-center justify-center gap-2 hover:bg-black/5 transition-colors"
        >
          <span className="rotate-180 inline-flex"><IconArrow className="w-4 h-4" /></span>
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isLocationValid || !venueAddress.trim()}
          className="w-2/3 bg-[#1090F8] hover:bg-[#1090F8]/90 disabled:opacity-50 text-white text-sm font-semibold py-4 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
        >
          <span>Next: Payment Option</span>
          <IconArrow className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
