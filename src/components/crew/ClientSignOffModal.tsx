import React, { useEffect, useRef, useState } from 'react';
import { IconCheck, IconX, IconSignature, IconShield, IconBox } from '../shared/icons';
import { ModalOverlay } from '../shared/ModalOverlay';

export interface ClientSignOffData {
  clientName: string;
  signerRole: string;
  signatureUrl: string;
  signedAt: string;
  verifiedItems: string[];
  notes?: string;
}

interface ClientSignOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  defaultClientName: string;
  venueName: string;
  packageName: string;
  onSaveSignOff: (data: ClientSignOffData) => void;
}

const DEFAULT_CHECKLIST_ITEMS = [
  'Soundcheck Verified: PA speakers and wireless microphones tested loud, clear, and feedback-free.',
  'Lighting & Visuals Verified: Moving heads, truss fixtures, and LED video wall calibrated & responsive.',
  'Staging & Cable Safety: XLR & power snake lines taped down, stands locked, and rigging secured safely.',
  'Equipment Acceptance: All requested package gear is physically on-site and fully operational.',
];

export default function ClientSignOffModal({
  isOpen,
  onClose,
  bookingId,
  defaultClientName,
  venueName,
  packageName,
  onSaveSignOff,
}: ClientSignOffModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [clientName, setClientName] = useState(defaultClientName || '');
  const [signerRole, setSignerRole] = useState('Event Client / Host');
  const [notes, setNotes] = useState('');
  const [checkedItems, setCheckedItems] = useState<string[]>(DEFAULT_CHECKLIST_ITEMS);

  // Initialize Canvas DPI on open
  useEffect(() => {
    if (!isOpen) return;
    setClientName(defaultClientName || '');
    setHasSignature(false);
    setCheckedItems(DEFAULT_CHECKLIST_ITEMS);

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(window.devicePixelRatio || 1, 1);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#0f172a';
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, defaultClientName]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
  };

  const toggleChecklistItem = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleConfirmSignOff = () => {
    if (!hasSignature || !canvasRef.current) {
      alert('Please have the client sign on the pad before confirming.');
      return;
    }
    if (!clientName.trim()) {
      alert('Please enter the client or authorized representative name.');
      return;
    }

    const signatureUrl = canvasRef.current.toDataURL('image/png');
    const signedAt = new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    onSaveSignOff({
      clientName: clientName.trim(),
      signerRole,
      signatureUrl,
      signedAt,
      verifiedItems: checkedItems,
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl border border-[#24252c]/10 overflow-hidden relative flex flex-col max-h-[92vh]">
        {/* Header - Client Handoff Mode */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#24252c]/[0.08] bg-gradient-to-r from-emerald-500/10 via-[var(--mist)] to-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-black text-xs text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                {bookingId}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <IconShield className="w-3 h-3 text-emerald-600" />
                <span>Client Ingress Acceptance</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight">
              Ingress & Soundcheck Digital Sign-Off
            </h2>
            <p className="text-xs text-[#24252c]/70 mt-0.5 font-medium">
              Hand this device to the client to verify all equipment functionality before the event begins.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#24252c]/10 hover:bg-gray-100 flex items-center justify-center text-[#24252c]/60 hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] text-xs grid sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[#24252c]/50 font-semibold block text-[10px] uppercase tracking-wider">Package / Production:</span>
              <span className="font-bold text-[var(--ink)] text-xs block">{packageName}</span>
            </div>
            <div>
              <span className="text-[#24252c]/50 font-semibold block text-[10px] uppercase tracking-wider">Venue Location:</span>
              <span className="font-bold text-[var(--ink)] text-xs block">{venueName}</span>
            </div>
          </div>

          {/* Client Signer Details Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="font-extrabold text-[var(--ink)] block mb-1">
                Client / Authorized Signer Name *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client or representative full name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#24252c]/15 focus:outline-none focus:border-[#1090F8] bg-white font-semibold"
              />
            </div>

            <div>
              <label className="font-extrabold text-[var(--ink)] block mb-1">
                Role / Designation
              </label>
              <select
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#24252c]/15 focus:outline-none focus:border-[#1090F8] bg-white font-semibold cursor-pointer"
              >
                <option value="Event Client / Host">Event Client / Host</option>
                <option value="Wedding / Event Coordinator">Wedding / Event Coordinator</option>
                <option value="Venue Banquet Manager">Venue Banquet Manager</option>
                <option value="Authorized Representative">Authorized Representative</option>
              </select>
            </div>
          </div>

          {/* Equipment Acceptance Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24252c]/70 uppercase tracking-wider">
                Soundcheck & Functionality Acceptance Checklist
              </label>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {checkedItems.length} of {DEFAULT_CHECKLIST_ITEMS.length} Checked
              </span>
            </div>

            <div className="space-y-2 bg-[var(--mist)] p-3.5 rounded-2xl border border-[#24252c]/[0.06]">
              {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => {
                const isChecked = checkedItems.includes(item);
                return (
                  <label
                    key={idx}
                    onClick={() => toggleChecklistItem(item)}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-white border-emerald-500/30 shadow-2xs'
                        : 'bg-white/50 border-[#24252c]/10 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-4 h-4 mt-0.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-medium text-[var(--ink)] leading-snug">
                      {item}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Interactive Digital Signature Pad */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24252c]/70 uppercase tracking-wider flex items-center gap-1.5">
                <IconSignature className="w-3.5 h-3.5 text-[#1090F8]" />
                <span>Client Digital Signature (Sign with finger or stylus) *</span>
              </label>
              <button
                type="button"
                onClick={handleClearSignature}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Clear Signature
              </button>
            </div>

            {/* Drawing Canvas Box */}
            <div className="relative rounded-2xl border-2 border-dashed border-[#24252c]/20 bg-[#fafafa] hover:border-[#1090F8]/50 transition-colors overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{ touchAction: 'none' }}
                className="w-full h-44 cursor-crosshair block"
              />

              {/* Signature Line Guideline */}
              <div className="pointer-events-none absolute bottom-8 left-8 right-8 flex items-center gap-2 border-b border-gray-300 pb-1">
                <span className="text-[11px] text-gray-400 font-mono select-none">✕</span>
                <span className="text-[10px] text-gray-400 font-medium select-none">
                  Sign above this line
                </span>
              </div>

              {!hasSignature && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400 font-semibold select-none">
                  Draw signature here using finger or mouse
                </div>
              )}
            </div>
          </div>

          {/* Optional Client Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-[#24252c]/70 uppercase tracking-wider">
              Client Feedback / Sound & Lighting Requests (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please increase mic treble during wedding vows, warm amber spotlight on bridal entrance..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#24252c]/15 focus:outline-none focus:border-[#1090F8] bg-white text-xs"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--mist)] border-t border-[#24252c]/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-[#24252c]/60 flex items-center gap-1.5">
            <IconShield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Legally binding on-site equipment acceptance record.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full border border-[#24252c]/15 bg-white text-xs font-bold text-[var(--ink)] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSignOff}
              disabled={!hasSignature}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                hasSignature
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <IconCheck className="w-4 h-4" />
              <span>Confirm & Lock Sign-Off</span>
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
