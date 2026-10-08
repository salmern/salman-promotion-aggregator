'use client';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import type { BrandWithCount } from '@promotions/shared';

export interface FilterState {
  search: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  brand: string;
}

interface Props {
  filters: FilterState;
  brands: BrandWithCount[];
  onChange: (filters: FilterState) => void;
  onClear: () => void;
}

/**
 * Parse a loosely-typed date string into YYYY-MM-DD.
 * Accepts: "Oct 10", "Oct 10 2026", "10/10", "10/10/2026", "2026-10-10"
 * Returns null if unparseable.
 */
function parseLooseDate(raw: string): string | null {
  if (!raw.trim()) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();

  // Try native Date — handles "Oct 10", "October 10 2026", "10/10/2026"
  const currentYear = new Date().getFullYear();
  const withYear = /\d{4}/.test(raw) ? raw : `${raw} ${currentYear}`;
  const d = new Date(withYear);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

/** Format YYYY-MM-DD as "Oct 10" for display */
function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

export function Filters({ filters, brands, onChange, onClear }: Props) {
  const hasFilters = filters.search || filters.startDate || filters.endDate || filters.brand;
  const set = (key: keyof FilterState, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="bg-white rounded-2xl shadow-card px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">

        {/* ── Search ───────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-[180px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search promotions…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-surface-tertiary
                       bg-surface-secondary text-ink-primary placeholder-ink-tertiary
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                       transition-colors"
            aria-label="Search promotions"
          />
        </div>

        {/* Thin divider */}
        <div className="hidden sm:block w-px h-7 bg-surface-tertiary shrink-0" />

        {/* ── Date range ───────────────────────────────────────────── */}
        <DateRangeInput
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(start, end) => onChange({ ...filters, startDate: start, endDate: end })}
        />

        {/* Thin divider */}
        <div className="hidden sm:block w-px h-7 bg-surface-tertiary shrink-0" />

        {/* ── Brand ────────────────────────────────────────────────── */}
        <div className="relative min-w-[140px]">
          <select
            value={filters.brand}
            onChange={(e) => set('brand', e.target.value)}
            className={cn(
              'appearance-none w-full py-2.5 pl-3 pr-8 text-sm rounded-xl border border-surface-tertiary',
              'bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
              'transition-colors cursor-pointer',
              filters.brand ? 'text-ink-primary font-medium' : 'text-ink-tertiary',
            )}
            aria-label="Filter by brand"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name} ({b.promotionCount})
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ── Clear all ─────────────────────────────────────────────── */}
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs text-ink-tertiary hover:text-error transition-colors shrink-0
                       focus:outline-none focus:ring-2 focus:ring-error rounded px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.search && (
            <Pill
              label={`"${filters.search}"`}
              onRemove={() => set('search', '')}
            />
          )}
          {(filters.startDate || filters.endDate) && (
            <Pill
              label={
                filters.startDate && filters.endDate
                  ? `${formatDisplayDate(filters.startDate)} – ${formatDisplayDate(filters.endDate)}`
                  : filters.startDate
                    ? `From ${formatDisplayDate(filters.startDate)}`
                    : `Until ${formatDisplayDate(filters.endDate)}`
              }
              onRemove={() => onChange({ ...filters, startDate: '', endDate: '' })}
            />
          )}
          {filters.brand && (
            <Pill label={filters.brand} onRemove={() => set('brand', '')} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date Range Input ─────────────────────────────────────────────────────────

interface DateRangeInputProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

function DateRangeInput({ startDate, endDate, onChange }: DateRangeInputProps) {
  // Display values (human-readable). ISO values live in parent state.
  const [fromText, setFromText] = useState(startDate ? formatDisplayDate(startDate) : '');
  const [toText, setToText] = useState(endDate ? formatDisplayDate(endDate) : '');
  const toRef = useRef<HTMLInputElement>(null);

  // Sync display when parent resets (e.g. Clear all)
  useEffect(() => {
    if (!startDate) setFromText('');
  }, [startDate]);
  useEffect(() => {
    if (!endDate) setToText('');
  }, [endDate]);

  function commitFrom(raw: string) {
    const iso = parseLooseDate(raw);
    if (iso) {
      setFromText(formatDisplayDate(iso));
      onChange(iso, endDate);
      // Auto-focus the "to" field after picking a start date
      toRef.current?.focus();
    } else if (!raw.trim()) {
      setFromText('');
      onChange('', endDate);
    }
  }

  function commitTo(raw: string) {
    const iso = parseLooseDate(raw);
    if (iso) {
      setToText(formatDisplayDate(iso));
      onChange(startDate, iso);
    } else if (!raw.trim()) {
      setToText('');
      onChange(startDate, '');
    }
  }

  const hasValue = startDate || endDate;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-colors',
        'text-sm bg-surface-secondary',
        hasValue
          ? 'border-accent/40 ring-1 ring-accent/20'
          : 'border-surface-tertiary focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30',
      )}
    >
      {/* Calendar icon */}
      <svg className="w-3.5 h-3.5 text-ink-tertiary shrink-0" fill="none" stroke="currentColor"
        viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      {/* From */}
      <input
        type="text"
        value={fromText}
        onChange={(e) => setFromText(e.target.value)}
        onBlur={(e) => commitFrom(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commitFrom(fromText); }}
        placeholder="From"
        className="w-16 bg-transparent outline-none text-ink-primary placeholder-ink-tertiary text-sm"
        aria-label="Active from date — type e.g. Oct 10"
      />

      <span className="text-ink-tertiary text-xs select-none">–</span>

      {/* To */}
      <input
        ref={toRef}
        type="text"
        value={toText}
        onChange={(e) => setToText(e.target.value)}
        onBlur={(e) => commitTo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commitTo(toText); }}
        placeholder="To"
        className="w-16 bg-transparent outline-none text-ink-primary placeholder-ink-tertiary text-sm"
        aria-label="Active to date — type e.g. Oct 20"
      />
    </div>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1
                     rounded-full bg-accent/10 text-accent select-none">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full
                   hover:bg-accent/20 transition-colors focus:outline-none"
        aria-label={`Remove filter ${label}`}
      >
        ×
      </button>
    </span>
  );
}
