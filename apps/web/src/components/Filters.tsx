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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-ink-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

        {/* Start date */}
        <div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            className="input"
            aria-label="Start date filter"
          />
        </div>

        {/* End date */}
        <div>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            className="input"
            aria-label="End date filter"
          />
        </div>

        {/* Brand */}
        <div>
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
      {hasFilters && (
        <div className="flex justify-end">
          <button
            onClick={onClear}
            className="text-xs text-ink-secondary hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
          >
            Clear filters ×
          </button>
        </div>
      )}
    </div>
  );
}
