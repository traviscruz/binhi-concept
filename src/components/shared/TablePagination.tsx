import React from 'react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to show with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [1];

    if (safePage > 3) {
      pages.push('ellipsis-start');
    }

    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safePage < totalPages - 2) {
      pages.push('ellipsis-end');
    }

    pages.push(totalPages);
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-[#24252c]/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs select-none">
      {/* Left: Page Size Selector and Entry Count */}
      <div className="flex items-center gap-2 text-[#24252c]/70 flex-wrap justify-center sm:justify-start">
        <span className="font-medium">Show</span>
        <div className="relative inline-block">
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-[#EEEEEE] text-[var(--ink)] font-bold text-xs rounded-full pl-3 pr-7 py-1.5 border border-transparent focus:border-[#1090F8] focus:outline-none cursor-pointer appearance-none"
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#24252c]/50">
            ▼
          </span>
        </div>
        <span className="font-medium hidden sm:inline">per page</span>
        <span className="text-[#24252c]/20 hidden sm:inline">•</span>
        <span className="text-[#24252c]/60">
          Showing <strong className="text-[var(--ink)] font-bold">{startIndex}–{endIndex}</strong> of{' '}
          <strong className="text-[var(--ink)] font-bold">{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Pagination Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#24252c]/10 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <span>←</span>
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`${p}-${idx}`}
                  className="px-1.5 text-xs text-[#24252c]/40"
                >
                  •••
                </span>
              );
            }

            const isActive = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[30px] h-[30px] rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-[var(--ink)] text-white shadow-xs'
                    : 'bg-[var(--mist)] text-[#24252c]/70 hover:text-[var(--ink)] hover:bg-[#24252c]/10 border border-[#24252c]/[0.06]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#24252c]/10 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <span className="hidden sm:inline">Next</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
