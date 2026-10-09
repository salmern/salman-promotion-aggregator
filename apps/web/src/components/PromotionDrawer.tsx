'use client';
import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Promotion } from '@promotions/shared';
import { formatDate, isExpiringSoon, isExpired, cn } from '../lib/utils';

interface Props {
  promotion: Promotion | null;
  onClose: () => void;
}

const STATUS_CONFIG = {
  pending:       { label: null,                      className: '' },
  verified:      { label: 'Verified',                className: 'bg-green-50 text-green-700 border-green-200' },
  changed:       { label: 'Data may have changed',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  gone:          { label: 'No longer at source',     className: 'bg-red-50 text-red-700 border-red-200' },
  unverifiable:  { label: 'Could not be verified',   className: 'bg-surface-secondary text-ink-secondary border-surface-tertiary' },
} as const;

export function PromotionDrawer({ promotion, onClose }: Props) {
  // Close on Escape key
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!promotion) return;
    document.addEventListener('keydown', handleKey);
    // Prevent body scroll while drawer is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [promotion, handleKey]);

  if (!promotion) return null;

  const expired = isExpired(promotion.endDate);
  const expiringSoon = isExpiringSoon(promotion.endDate);
  const status = STATUS_CONFIG[promotion.verificationStatus] ?? STATUS_CONFIG.pending;
  const brand = promotion.brand;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — slides in from the right */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={promotion.name}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-modal
                   flex flex-col overflow-hidden animate-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-tertiary shrink-0">
          <span className="text-xs font-semibold text-accent uppercase tracking-widest">
            {brand.name}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-ink-tertiary
                       hover:bg-surface-secondary hover:text-ink-primary transition-colors
                       focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          {promotion.imageUrl && (
            <div className="relative aspect-[16/9] w-full bg-surface-secondary">
              <Image
                src={promotion.imageUrl}
                alt={promotion.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          <div className="px-5 py-5 space-y-5">
            {/* Title */}
            <div>
              <h2 className="text-lg font-semibold text-ink-primary leading-snug">
                {promotion.name}
              </h2>
            </div>

            {/* Verification state banner — shown for all statuses except pending has its own note */}
            {promotion.verificationStatus === 'pending' ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-tertiary bg-surface-secondary text-xs text-ink-tertiary">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Not yet verified against source
              </div>
            ) : status.label && (
              <div className={cn(
                'flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs',
                status.className,
              )}>
                <span className="leading-relaxed">{status.label}</span>
                {promotion.lastVerifiedAt && (
                  <span className="ml-auto shrink-0 opacity-60">
                    {formatDate(promotion.lastVerifiedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              {promotion.startDate && (
                <div className="bg-surface-secondary rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide mb-0.5">
                    Starts
                  </p>
                  <p className="text-sm font-medium text-ink-primary">
                    {formatDate(promotion.startDate)}
                  </p>
                </div>
              )}
              {promotion.endDate && (
                <div className={cn(
                  'rounded-xl px-3 py-2.5',
                  expired
                    ? 'bg-surface-secondary'
                    : expiringSoon
                      ? 'bg-orange-50'
                      : 'bg-surface-secondary',
                )}>
                  <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide mb-0.5">
                    {expired ? 'Ended' : 'Ends'}
                  </p>
                  <p className={cn(
                    'text-sm font-medium',
                    expired ? 'text-ink-tertiary' : expiringSoon ? 'text-orange-600' : 'text-ink-primary',
                  )}>
                    {formatDate(promotion.endDate)}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {promotion.description && (
              <div>
                <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">
                  Details
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {promotion.description}
                </p>
              </div>
            )}

            {/* Brand info */}
            <div className="border border-surface-tertiary rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide">
                About {brand.name}
              </p>

              {/* Hours */}
              {brand.hours && brand.hours.length > 0 && (
                <div className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-ink-tertiary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="space-y-0.5">
                    {brand.hours.map((h, i) => (
                      <p key={i} className="text-xs text-ink-secondary">
                        <span className="font-medium text-ink-primary">{h.days}:</span>{' '}
                        {h.open} – {h.close}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Website */}
              {brand.websiteUrl && (
                <a
                  href={brand.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); window.open(brand.websiteUrl!, '_blank', 'noopener,noreferrer'); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Visit {brand.name} website
                </a>
              )}
            </div>

            {/* Source link */}
            <a
              href={promotion.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center"
            >
              View deal at source
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Meta */}
            <p className="text-[10px] text-ink-tertiary text-center">
              Scraped {formatDate(promotion.scrapedAt)} · America/Denver
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
