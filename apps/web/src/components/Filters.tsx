'use client';
import { cn } from '../lib/utils';
import type { BrandWithCount } from '@promotions/shared';

export interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  brand: string;
}

interface Props {
  filters: FilterState;
  brands: BrandWithCount[];
  onChange: (filters: FilterState) => void;
  onClear: () => void;
}

export function Filters({ filters, brands, onChange, onClear }: Props) {
  const hasFilters =
    filters.search || filters.startDate || filters.endDate || filters.brand;

  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  // Validation: end date must not be before start date
  const dateError =
    filters.startDate && filters.endDate && filters.endDate < filters.startDate
      ? '"To" date must be on or after "From" date'
      : null;

  function handleStartDate(value: string) {
    // If a start date is set that's after the current end date, clear end date
    // to avoid silently passing an invalid range to the API.
    if (value && filters.endDate && filters.endDate < value) {
      onChange({ ...filters, startDate: value, endDate: '' });
    } else {
      set('startDate', value);
    }
  }

  function handleEndDate(value: string) {
    set('endDate', value);
    // Visual error is shown below — we don't silently clear here so the
    // user sees the feedback and can correct deliberately.
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">

        {/* ── Search ─────────────────────────────────────────────── */}
        <div className="relative lg:col-span-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-ink-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0118 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search promotions…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="input pl-9"
            aria-label="Search promotions"
          />
        </div>

        {/* ── Date range ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          {/* Label sits above the pair */}
          <span className="text-[11px] font-medium text-ink-tertiary tracking-wide uppercase px-0.5">
            Active during
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleStartDate(e.target.value)}
                className={cn(
                  'input flex-1 min-w-0',
                  dateError && 'border-error focus:ring-error focus:border-error',
                )}
                aria-label="Active from date"
                aria-invalid={!!dateError}
                // Prevent selecting a start date after today + 1 year (sanity cap)
                max={filters.endDate || undefined}
              />
              <span className="text-ink-tertiary text-xs select-none shrink-0">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleEndDate(e.target.value)}
                className={cn(
                  'input flex-1 min-w-0',
                  dateError && 'border-error focus:ring-error focus:border-error',
                )}
                aria-label="Active to date"
                aria-invalid={!!dateError}
                aria-describedby={dateError ? 'date-error' : undefined}
                // Prevent selecting an end date before the start date
                min={filters.startDate || undefined}
              />
            </div>

            {/* Inline error — shown below the fields, not in a toast */}
            {dateError && (
              <p
                id="date-error"
                role="alert"
                className="text-[11px] text-error px-0.5 flex items-center gap-1"
              >
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {dateError}
              </p>
            )}
          </div>
        </div>

        {/* ── Brand ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <select
            value={filters.brand}
            onChange={(e) => set('brand', e.target.value)}
            className="input"
            aria-label="Filter by brand"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name} ({b.promotionCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear */}
      {hasFilters && !dateError && (
        <div className="flex justify-end">
          <button
            onClick={onClear}
            className="text-xs text-ink-tertiary hover:text-error transition-colors focus:outline-none focus:ring-2 focus:ring-error rounded px-1"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
