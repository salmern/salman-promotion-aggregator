'use client';
import { useState, useCallback, useMemo } from 'react';
import { usePromotions } from '../hooks/usePromotions';
import { useBrands } from '../hooks/useBrands';
import { useScrapeJob } from '../hooks/useScrapeJob';
import { PromotionCard } from '../components/PromotionCard';
import { BrandSection } from '../components/BrandSection';
import { Filters } from '../components/Filters';
import type { FilterState } from '../components/Filters';
import { Pagination } from '../components/Pagination';
import { SkeletonGrid } from '../components/SkeletonCard';
import type { BrandWithCount } from '@promotions/shared';

const EMPTY_FILTERS: FilterState = { search: '', startDate: '', endDate: '', brand: '' };
const PAGE_SIZE = 18;

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'brands'>('grid');

  // When filters change, reset to page 1
  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f);
    setPage(1);
  }, []);

  const query = useMemo(() => ({
    search: filters.search || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    brand: filters.brand || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [filters, page]);

  const { data, loading, error, refetch } = usePromotions(query);
  const { brands, loading: brandsLoading } = useBrands();

  const { state: scrapeState, startScrape, cancelScrape, reset: resetScrape } = useScrapeJob(
    // After scrape completes, refresh promotions
    () => void refetch(),
  );

  // Group promotions by brand for the brand view
  const groupedByBrand = useMemo(() => {
    if (!data || viewMode !== 'brands') return null;
    const map = new Map<number, typeof data.items>();
    for (const p of data.items) {
      const existing = map.get(p.brandId) ?? [];
      existing.push(p);
      map.set(p.brandId, existing);
    }
    return map;
  }, [data, viewMode]);

  const brandsInView = useMemo(() => {
    if (!groupedByBrand || !brands.length) return [] as BrandWithCount[];
    return brands.filter((b) => groupedByBrand.has(b.id));
  }, [groupedByBrand, brands]);

  // Scrape state shape for ScrapeStatusBar
  const scrapeBarState = useMemo(() => {
    if (scrapeState.phase === 'polling') {
      return {
        phase: 'polling' as const,
        jobId: scrapeState.jobId,
        counts: scrapeState.status.counts,
        jobState: scrapeState.status.state,
      };
    }
    if (scrapeState.phase === 'done') {
      return {
        phase: 'done' as const,
        jobId: scrapeState.jobId,
        counts: scrapeState.status.counts,
        jobState: scrapeState.status.state,
      };
    }
    return { phase: scrapeState.phase as 'idle' | 'starting' | 'error', message: scrapeState.phase === 'error' ? (scrapeState as { phase: 'error'; message: string }).message : undefined };
  }, [scrapeState]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-surface-tertiary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-semibold text-ink-primary tracking-tight">
                Promotions
              </span>
              <span className="text-lg font-light text-ink-tertiary hidden sm:block">
                · Briargate
              </span>
            </div>

            {/* Scrape controls */}
            <div className="flex items-center gap-2">
              {scrapeState.phase === 'idle' && (
                <button onClick={() => void startScrape()} className="btn-primary text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Sync</span>
                </button>
              )}
              {(scrapeState.phase === 'starting' || scrapeState.phase === 'polling') && (
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">
                    {scrapeState.phase === 'starting' ? 'Starting…' : 'Syncing…'}
                  </span>
                  {scrapeState.phase === 'polling' && (
                    <button
                      onClick={() => void cancelScrape(scrapeState.jobId)}
                      className="ml-1 text-xs text-error hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              {scrapeState.phase === 'done' && (
                <button onClick={resetScrape} className="btn-secondary text-xs">
                  {scrapeState.status.state === 'completed' ? '✓ Done' : '✕ Failed'}
                </button>
              )}
              {scrapeState.phase === 'error' && (
                <button onClick={resetScrape} className="btn-secondary text-xs text-error">
                  Error — retry
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero */}
        <div>
          <h1 className="text-3xl font-semibold text-ink-primary tracking-tight">
            Promotions
          </h1>
          <p className="mt-1 text-base text-ink-secondary">
            The Promenade Shops at Briargate · Colorado Springs
          </p>
        </div>

        {/* Filters */}
        <Filters
          filters={filters}
          brands={brands}
          onChange={handleFilterChange}
          onClear={() => { handleFilterChange(EMPTY_FILTERS); }}
        />

        {/* View toggle + result count */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            {loading ? (
              <span className="skeleton h-4 w-24 inline-block" />
            ) : data ? (
              <>
                <span className="font-medium text-ink-primary">{data.pagination.total}</span>{' '}
                promotion{data.pagination.total !== 1 ? 's' : ''}
              </>
            ) : null}
          </p>

          <div className="flex items-center bg-surface-secondary rounded-xl p-1 gap-1" role="group" aria-label="View mode">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-ink-primary shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
              aria-pressed={viewMode === 'grid'}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('brands')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'brands'
                  ? 'bg-white text-ink-primary shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
              aria-pressed={viewMode === 'brands'}
            >
              By Brand
            </button>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-2xl">⚠️</p>
            <p className="text-ink-secondary">{error}</p>
            <button onClick={() => void refetch()} className="btn-secondary mx-auto">
              Try again
            </button>
          </div>
        ) : loading ? (
          <SkeletonGrid count={PAGE_SIZE} />
        ) : !data || data.items.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <p className="text-4xl">🏷️</p>
            <h3 className="text-lg font-semibold text-ink-primary">No promotions found</h3>
            <p className="text-ink-secondary text-sm max-w-sm mx-auto">
              {filters.search || filters.brand || filters.startDate || filters.endDate
                ? 'Try adjusting your filters, or clear them to see all promotions.'
                : 'No promotions have been scraped yet. Click Sync to fetch promotions from the source.'}
            </p>
            {(filters.search || filters.brand) && (
              <button onClick={() => handleFilterChange(EMPTY_FILTERS)} className="btn-secondary mx-auto">
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'brands' ? (
          <div className="space-y-8">
            {brandsInView.length === 0 && !brandsLoading ? (
              <p className="text-sm text-ink-secondary">No brand data available.</p>
            ) : (
              brandsInView.map((brand) => (
                <BrandSection
                  key={brand.id}
                  brand={brand}
                  promotions={groupedByBrand?.get(brand.id) ?? []}
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((promo) => (
              <PromotionCard key={promo.id} promotion={promo} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            pageSize={data.pagination.pageSize}
            onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-tertiary mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-ink-tertiary text-center">
            Promotions Aggregator · Data sourced from thepromenadeshopsatbriargate.com
          </p>
        </div>
      </footer>
    </div>
  );
}
