'use client';
import type { BrandWithCount, Promotion } from '@promotions/shared';
import { PromotionCard } from './PromotionCard';

interface Props {
  brand: BrandWithCount;
  promotions: Promotion[];
}

export function BrandSection({ brand, promotions }: Props) {
  if (promotions.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Brand header */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-ink-primary">{brand.name}</h2>
            <span className="badge bg-accent/10 text-accent">
              {promotions.length} deal{promotions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Hours */}
          {brand.hours && brand.hours.length > 0 ? (
            <div className="mt-2 flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 text-ink-tertiary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {brand.hours.map((h, i) => (
                  <span key={i} className="text-xs text-ink-secondary">
                    <span className="font-medium">{h.days}:</span> {h.open}–{h.close}
                  </span>
                ))}
              </div>
            </div>
          ) : brand.hoursRaw ? (
            <div className="mt-2 flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 text-ink-tertiary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-ink-secondary">{brand.hoursRaw}</p>
            </div>
          ) : null}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3 shrink-0">
          {brand.websiteUrl && (
            <a
              href={brand.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !px-3 !py-1.5 !text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Website
            </a>
          )}
          {brand.sourceUrl && (
            <a
              href={`https://www.thepromenadeshopsatbriargate.com${brand.sourceUrl.replace(/^https?:\/\/[^/]+/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-tertiary hover:text-accent transition-colors"
            >
              Mall page
            </a>
          )}
        </div>
      </div>

      {/* Promotions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} />
        ))}
      </div>
    </section>
  );
}
