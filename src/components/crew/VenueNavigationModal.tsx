import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AssignedBooking } from '../../data/crewBookings';
import { getGoogleMapsUrl, getWazeUrl } from '../../utils/navigation';
import {
  IconX,
  IconPin,
  IconGoogleMaps,
  IconWaze,
  IconCopy,
  IconCheck,
  IconCalendar,
  IconClock,
  IconExternal,
} from '../shared/icons';
import { ModalOverlay } from '../shared/ModalOverlay';

interface VenueNavigationModalProps {
  booking: AssignedBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VenueNavigationModal({
  booking,
  isOpen,
  onClose,
}: VenueNavigationModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isOpen || !booking || !mapContainerRef.current) return;

    const lat = booking.coordinates.lat;
    const lng = booking.coordinates.lng;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([lat, lng], 15);

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom modern pulse marker
    const customIcon = L.divIcon({
      className: 'custom-venue-pin',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(16, 144, 248, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: #1090F8; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2.5px solid white;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34],
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    const popupHtml = `
      <div style="font-family: inherit; padding: 4px;">
        <strong style="display: block; font-size: 13px; color: #1e293b; margin-bottom: 2px;">${booking.venue}</strong>
        <p style="margin: 0 0 8px; font-size: 11px; color: #64748b; line-height: 1.3;">${booking.venueAddress}</p>
        <div style="display: flex; gap: 6px;">
          <a href="${getWazeUrl(booking.venueAddress, lat, lng)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #33CCFF; color: #0d3b4c; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 6px; text-decoration: none;">Open Waze</a>
          <a href="${getGoogleMapsUrl(booking.venueAddress, lat, lng)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #1A73E8; color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 6px; text-decoration: none;">Google Maps</a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    // Invalidate size after modal animation finishes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, booking]);

  if (!booking) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(booking.venueAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wazeUrl = getWazeUrl(
    booking.venueAddress,
    booking.coordinates.lat,
    booking.coordinates.lng
  );
  const gmapsUrl = getGoogleMapsUrl(
    booking.venueAddress,
    booking.coordinates.lat,
    booking.coordinates.lng
  );

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl border border-[#24252c]/10 overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#24252c]/[0.08] flex items-start justify-between gap-4 bg-gradient-to-r from-[var(--mist)] to-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-black text-xs text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                {booking.id}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase tracking-wider">
                Venue Directions
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight">
              Venue Navigation & Route
            </h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              One-tap direct routing for assigned crew dispatch and on-site logistics.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#24252c]/10 hover:bg-gray-100 flex items-center justify-center text-[#24252c]/60 hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Main Venue Card */}
          <div className="bg-[var(--mist)] p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.06] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1090F8]">
                  <IconPin className="w-4 h-4 shrink-0 text-[#1090F8]" />
                  <span>Destination Venue</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-[var(--ink)]">
                  {booking.venue}
                </h3>
                <p className="text-xs text-[#24252c]/75 leading-relaxed font-medium">
                  {booking.venueAddress}
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#24252c]/10 hover:border-[#1090F8] text-[var(--ink)] transition-colors shadow-2xs cursor-pointer"
                title="Copy venue address"
              >
                {copied ? (
                  <>
                    <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy className="w-3.5 h-3.5 text-[#24252c]/60" />
                    <span>Copy Address</span>
                  </>
                )}
              </button>
            </div>

            {/* Time & Rigging Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#24252c]/[0.06] text-xs">
              <div className="flex items-center gap-2 bg-white/70 px-3 py-2 rounded-xl border border-[#24252c]/[0.05]">
                <IconClock className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Call Time</span>
                  <span className="font-extrabold text-[var(--ink)]">{booking.callTime}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/70 px-3 py-2 rounded-xl border border-[#24252c]/[0.05]">
                <IconCalendar className="w-4 h-4 text-[#1090F8] shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Event Date</span>
                  <span className="font-extrabold text-[var(--ink)]">{booking.date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ONE-TAP LAUNCH BUTTONS */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold text-[#24252c]/60 uppercase tracking-wider block">
              One-Tap Turn-by-Turn Navigation Apps
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WAZE BUTTON */}
              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#33CCFF] to-[#00B4E8] text-[#052936] hover:shadow-md hover:scale-[1.01] transition-all font-bold cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center text-[#00B4E8] shadow-xs group-hover:scale-105 transition-transform">
                    <IconWaze className="w-6 h-6 text-[#0096C7]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-wider text-[#052936]/80 font-black">
                      Navigate with
                    </div>
                    <div className="text-base font-black text-[#052936]">Waze Live</div>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <IconExternal className="w-4 h-4 text-[#052936]" />
                </div>
              </a>

              {/* GOOGLE MAPS BUTTON */}
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#1A73E8] to-[#1557b0] text-white hover:shadow-md hover:scale-[1.01] transition-all font-bold cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <IconGoogleMaps className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-wider text-blue-100 font-black">
                      Navigate with
                    </div>
                    <div className="text-base font-black text-white">Google Maps</div>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <IconExternal className="w-4 h-4 text-white" />
                </div>
              </a>
            </div>
          </div>

          {/* Interactive Leaflet Map Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24252c]/60 uppercase tracking-wider">
                Venue Location Map Preview
              </label>
              <span className="text-[10px] text-[#24252c]/50 font-mono">
                {booking.coordinates.lat.toFixed(4)}° N, {booking.coordinates.lng.toFixed(4)}° E
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-[#24252c]/10 shadow-inner h-56 sm:h-64 relative bg-gray-100">
              <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>
          </div>

          {/* Loading Bay & Ingress Logistics Note */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[10px]">
              <span>Ingress & Loading Bay Gate Instructions</span>
            </div>
            <p className="text-amber-950 font-medium leading-relaxed">
              {booking.loadingBayNote}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--mist)] border-t border-[#24252c]/[0.08] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
