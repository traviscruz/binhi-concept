const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/pages/admin/AdminBookingsPage.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Dropdown replacement using regex
const dropdownRegex = /\{\/\*\s*Approve Deposit \(if pending\)\s*\*\/\}[\s\S]*?setSelectedReceipt\(row\);[\s\S]*?<\/button>\s*\)\}/;

const newDropdown = `{/* Approve / Review Booking (if pending) */}
                                   {row.status.includes('Pending') && (
                                     <>
                                       <button
                                         type="button"
                                         onClick={() => {
                                           setOpenActionMenuId(null);
                                           setApproveModalBooking(row);
                                         }}
                                         className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#1090F8] hover:bg-blue-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                       >
                                         <span className="w-5 h-5 rounded-md bg-[#1090F8]/15 text-[#1090F8] flex items-center justify-center shrink-0">
                                           <IconCheck className="w-3 h-3" />
                                         </span>
                                         <div className="flex flex-col min-w-0">
                                           <span className="truncate">Approve Booking</span>
                                           <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                             Technical &amp; schedule sign-off
                                           </span>
                                         </div>
                                       </button>

                                       <button
                                         type="button"
                                         onClick={() => {
                                           setOpenActionMenuId(null);
                                           setDeclineModalBooking(row);
                                         }}
                                         className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                       >
                                         <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                           <IconX className="w-3 h-3" />
                                         </span>
                                         <div className="flex flex-col min-w-0">
                                           <span className="truncate">Decline &amp; Refund</span>
                                           <span className="text-[10px] font-normal text-rose-600 truncate">
                                             100% deposit refund
                                           </span>
                                         </div>
                                       </button>
                                     </>
                                   )}`;

if (dropdownRegex.test(content)) {
  content = content.replace(dropdownRegex, newDropdown);
  console.log('Replaced dropdown actions.');
} else {
  console.warn('dropdownRegex did not match.');
}

// 2. Mobile approve replacement
const mobileRegex = /\{\s*row\.status\.includes\('Pending'\)\s*\?\s*\(\s*<button[\s\S]*?setSelectedReceipt\(row\)[\s\S]*?<\/button>\s*\)/;

const newMobileApprove = `{row.status.includes('Pending') ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setApproveModalBooking(row)}
                        className="flex-1 bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-bold py-2 rounded-full transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                      >
                        <IconCheck className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclineModalBooking(row)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold py-2 px-3 rounded-full transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                      >
                        <IconX className="w-3 h-3" />
                        <span>Decline</span>
                      </button>
                    </div>
                  )`;

if (mobileRegex.test(content)) {
  content = content.replace(mobileRegex, newMobileApprove);
  console.log('Replaced mobile approve action.');
} else {
  console.warn('mobileRegex did not match.');
}

// 3. Append modals
const newModals = `
      {/* ── Modal 6: Approve Booking & Confirm Staging Modal ── */}
      <ModalOverlay isOpen={Boolean(approveModalBooking)} onClose={() => setApproveModalBooking(null)}>
        {approveModalBooking && (
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative animate-blur-in text-xs max-h-[90vh] overflow-y-auto modal-scroll">
            <button
              type="button"
              onClick={() => setApproveModalBooking(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200 shrink-0 text-base">
                ✓
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Production Sign-Off
                </span>
                <h3 className="text-lg font-extrabold text-[var(--ink)] -mt-0.5">
                  Approve Booking &amp; Lock Schedule
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#24252c]/60 mb-4 leading-relaxed">
              Confirming this reservation will lock <strong className="text-[var(--ink)] font-mono">#{approveModalBooking.id}</strong> into the master production calendar and dispatch the official confirmation certificate to <strong className="text-[var(--ink)]">{approveModalBooking.email}</strong>.
            </p>

            {/* Booking Details Card */}
            <div className="bg-[var(--mist)]/70 rounded-2xl p-4 border border-[#24252c]/[0.06] space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Client:</span>
                <span className="font-bold text-[var(--ink)]">{approveModalBooking.customer}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Package:</span>
                <span className="font-bold text-[var(--ink)]">{approveModalBooking.package}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Event Date &amp; Time:</span>
                <span className="font-semibold text-[#1090F8]">
                  {approveModalBooking.date} ({approveModalBooking.startTime || '13:00'} – {approveModalBooking.endTime || '18:00'})
                </span>
              </div>
              <div className="flex justify-between items-start text-xs pt-1.5 border-t border-[#24252c]/[0.06]">
                <span className="text-[#24252c]/50">Venue:</span>
                <span className="font-medium text-[var(--ink)] text-right max-w-[220px]">{approveModalBooking.venue}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#24252c]/[0.06]">
                <span className="font-bold text-[var(--ink)]">Secured Downpayment:</span>
                <span className="font-black text-emerald-700 text-sm">₱{approveModalBooking.depositNum?.toLocaleString()}</span>
              </div>
            </div>

            {/* Technical Verification Checklist */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs space-y-1.5 mb-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
                Technical Verification Checklist:
              </span>
              <div className="flex items-center gap-2 text-[11px] text-emerald-800">
                <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px]">✓</span>
                <span>Venue electrical load capacity &amp; breaker specs verified</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-800">
                <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px]">✓</span>
                <span>Certified stage &amp; audio technicians allocated in crew roster</span>
              </div>
            </div>

            {/* Optional Admin Notes */}
            <div className="space-y-1.5 mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">
                Production Remarks / Crew Call-Time Notes (Optional):
              </label>
              <textarea
                rows={3}
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="e.g. Venue load approved; 2 sound technicians allocated. Call time: 11:00 AM."
                className="w-full rounded-2xl border border-black/10 px-3.5 py-2.5 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#24252c]/[0.06]">
              <button
                type="button"
                onClick={() => setApproveModalBooking(null)}
                className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveTechnicalReview}
                disabled={isProcessingApproval}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingApproval ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Approve &amp; Confirm Booking</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── Modal 7: Decline Booking & Issue 100% Refund Modal ── */}
      <ModalOverlay isOpen={Boolean(declineModalBooking)} onClose={() => setDeclineModalBooking(null)}>
        {declineModalBooking && (
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative animate-blur-in text-xs max-h-[90vh] overflow-y-auto modal-scroll">
            <button
              type="button"
              onClick={() => setDeclineModalBooking(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold border border-rose-200 shrink-0 text-base">
                <IconBan className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                  Technical Decision
                </span>
                <h3 className="text-lg font-extrabold text-[var(--ink)] -mt-0.5">
                  Decline Booking &amp; Issue 100% Refund
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#24252c]/60 mb-4 leading-relaxed">
              If venue specs or crew capacity cannot accommodate booking <strong className="text-[var(--ink)] font-mono">#{declineModalBooking.id}</strong>, declining will automatically issue a <strong>100% refund of ₱{declineModalBooking.depositNum?.toLocaleString()}</strong> and notify the client.
            </p>

            {/* 100% Refund Highlight Box */}
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                  100% Downpayment Refund Amount:
                </span>
                <span className="text-base font-black text-rose-800">₱{declineModalBooking.depositNum?.toLocaleString()}</span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                100% Refund Guarantee
              </span>
            </div>

            {/* Reason Selection */}
            <div className="space-y-1.5 mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">
                Select Technical / Scheduling Reason:
              </label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full rounded-full border border-black/15 px-4 py-2.5 bg-[#F8F9FA] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="Venue electrical power capacity insufficient for rig">
                  Venue electrical power capacity insufficient for requested equipment rig
                </option>
                <option value="All certified technician crew assigned or unavailable on date">
                  Certified technician crew capacity limit reached for this specific date
                </option>
                <option value="Venue physical clearance or structural rigging restrictions">
                  Venue physical clearance, height, or rigging restrictions
                </option>
                <option value="Location outside operating coverage or severe logistic constraint">
                  Location outside operating coverage or severe transit constraint
                </option>
                <option value="Others">Others (Custom reason)</option>
              </select>
            </div>

            {declineReason === 'Others' && (
              <div className="space-y-1 mb-3">
                <input
                  type="text"
                  value={declineCustomReason}
                  onChange={(e) => setDeclineCustomReason(e.target.value)}
                  placeholder="Specify custom reason for decline..."
                  className="w-full rounded-full border border-black/15 px-4 py-2 bg-[#F8F9FA] text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            {/* Detailed Notes for Customer Email */}
            <div className="space-y-1.5 mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">
                Additional Technical Remarks (Included in Refund Email):
              </label>
              <textarea
                rows={3}
                value={declineNotes}
                onChange={(e) => setDeclineNotes(e.target.value)}
                placeholder="e.g. Venue requires 60A breaker; client informed to rebook on alternative date or scaled package."
                className="w-full rounded-2xl border border-black/10 px-3.5 py-2.5 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-rose-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#24252c]/[0.06]">
              <button
                type="button"
                onClick={() => setDeclineModalBooking(null)}
                className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeclineAndRefund}
                disabled={isProcessingDecline}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingDecline ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Refund...</span>
                  </>
                ) : (
                  <>
                    <IconBan className="w-3.5 h-3.5" />
                    <span>Decline &amp; Refund 100%</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
`;

const lastModalIndex = content.lastIndexOf('</ModalOverlay>');
if (lastModalIndex !== -1) {
  const afterLastModal = lastModalIndex + '</ModalOverlay>'.length;
  content = content.slice(0, afterLastModal) + newModals + content.slice(afterLastModal);
  console.log('Successfully appended approval and decline modals after last ModalOverlay.');
} else {
  console.warn('Could not find last ModalOverlay.');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Update completed successfully.');
