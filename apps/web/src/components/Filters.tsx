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

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">

        {/* Search */}
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

        {/*
          Active during — a single labelled date range widget.
          These are FILTER dates, not the promotion's own dates.
          They answer: "show me deals valid during this period."
          Uses overlap logic: a deal matches if its period intersects [from, to].
        */}
        <div className="lg:col-span-1">
          <p className="text-[11px] font-medium text-ink-tertiary mb-1 tracking-wide uppercase">
            Active during
          </p>
          <div className="flex items-center gap-1.5 bg-white border border-surface-tertiary rounded-xl px-3 py-0 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-colors">
            {/* Calendar icon */}
            <svg className="w-3.5 h-3.5 text-ink-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="flex-1 min-w-0 py-2.5 text-sm text-ink-primary bg-transparent border-0 outline-none placeholder-ink-tertiary"
              aria-label="Active from date"
              title="Show promotions active from this date"
            />
            <span className="text-ink-tertiary text-xs select-none px-0.5">–</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              className="flex-1 min-w-0 py-2.5 text-sm text-ink-primary bg-transparent border-0 outline-none placeholder-ink-tertiary"
              aria-label="Active to date"
              title="Show promotions active until this date"
            />
          </div>
        </div>

        {/* Brand */}
        <div className="lg:col-span-2">
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

      {/* Active filter summary + clear */}
      {hasFilters && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {filters.search && (
              <FilterPill label={`"${filters.search}"`} onRemove={() => set('search', '')} />
            )}
            {(filters.startDate || filters.endDate) && (
              <FilterPill
                label={
                  filters.startDate && filters.endDate
                    ? `${filters.startDate} – ${filters.endDate}`
                    : filters.startDate
                      ? `From ${filters.startDate}`
                      : `Until ${filters.endDate}`
                }
                onRemove={() => onChange({ ...filters, startDate: '', endDate: '' })}
              />
            )}
            {filters.brand && (
              <FilterPill label={filters.brand} onRemove={() => set('brand', '')} />
            )}
          </div>
          <button
            onClick={onClear}
            className="text-xs text-ink-tertiary hover:text-error transition-colors focus:outline-none ml-2 shrink-0"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-accent-hover focus:outline-none"
        aria-label={`Remove filter ${label}`}
      >
        ×
      </button>
    </span>
  );
}
