'use client';
import type { BrandWithCount, Promotion } from '@promotions/shared';
import { PromotionCard } from './PromotionCard';

interface Props {
  brand: BrandWithCount;
  promotions: Promotion[];
  onPromotionClick?: (promotion: Promotion) => void;
}

/**
 * Deduplicates promotions by name within the same brand.
 * The source site sometimes publishes the same promotion under multiple deal IDs
 * (e.g. targeting different category filters). We show the first occurrence only.
 */
function dedupByName(promos: Promotion[]): Promotion[] {
  const seen = new Set<string>();
  return promos.filter((p) => {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function BrandSection({ brand, promotions, onPromotionClick }: Props) {
  const deduped = dedupByName(promotions);
  if (deduped.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Brand header card */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Name + deal count */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-ink-primary tracking-tight">
              {brand.name}
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {deduped.length} deal{deduped.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Hours */}
          {brand.hours && brand.hours.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-ink-tertiary mt-0.5 shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {brand.hours.map((h, i) => (
                  <span key={i} className="text-xs text-ink-secondary">
                    <span className="font-medium text-ink-primary">{h.days}:</span>{' '}
                    {h.open} – {h.close}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action links */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {brand.websiteUrl && (
            // Use an onClick redirect to ensure the link works across all browsers
            // regardless of popup-blocking. The href is still set for right-click/copy.
            <a
              href={brand.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(brand.websiteUrl!, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         rounded-xl border border-surface-tertiary bg-white text-ink-primary
                         hover:bg-surface-secondary hover:border-accent/30 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-ink-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Visit website
            </a>
          )}
          {brand.sourceUrl && (
            <a
              href={brand.sourceUrl.startsWith('http')
                ? brand.sourceUrl
                : `https://www.thepromenadeshopsatbriargate.com${brand.sourceUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-tertiary hover:text-accent transition-colors"
            >
              Mall page
            </a>
          )}
        </div>
      </div>

      {/* Promotions grid — deduplicated */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {deduped.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} onClick={onPromotionClick} />
        ))}
      </div>
    </section>
  );
}
