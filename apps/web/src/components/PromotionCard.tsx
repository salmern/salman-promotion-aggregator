'use client';
import Image from 'next/image';
import type { Promotion } from '@promotions/shared';
import { isExpiringSoon, isExpired, truncate, cn } from '../lib/utils';

interface Props {
  promotion: Promotion;
}

/**
 * Formats an end date into a human-readable label for the card badge.
 * All dates are displayed in America/Denver time per the API contract.
 */
function formatEndDateLabel(endDate: string): string {
  const DENVER_TZ = 'America/Denver';
  const now = new Date();
  const end = new Date(endDate);
  const msLeft = end.getTime() - now.getTime();

  if (msLeft < 0) return 'Expired';

  // Check if it ends today in Denver
  const todayDenver = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const endDenver = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(end);

  if (todayDenver === endDenver) return 'Ends today';

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDenver = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(tomorrow);
  if (tomorrowDenver === endDenver) return 'Ends tomorrow';

  // Within 7 days — show weekday
  if (msLeft < 7 * 24 * 60 * 60 * 1000) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: DENVER_TZ, weekday: 'long',
    }).format(end);
    return `Ends ${weekday}`;
  }

  // Default: "Ends Oct 19"
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, month: 'short', day: 'numeric',
  }).format(end);
  return `Ends ${formatted}`;
}

export function PromotionCard({ promotion }: Props) {
  const expired = isExpired(promotion.endDate);
  const expiringSoon = isExpiringSoon(promotion.endDate);
  const endLabel = promotion.endDate ? formatEndDateLabel(promotion.endDate) : null;

  return (
    <article
      className={cn(
        'card group flex flex-col overflow-hidden cursor-default',
        expired && 'opacity-55',
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-surface-secondary overflow-hidden">
        {promotion.imageUrl ? (
          <Image
            src={promotion.imageUrl}
            alt={promotion.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-secondary to-surface-tertiary">
            <span className="text-3xl opacity-25">🏷️</span>
          </div>
        )}

        {/* Verification overlay badge — top left */}
        {promotion.verificationStatus === 'changed' && (
          <div className="absolute top-2 left-2">
            <span className="badge bg-warning/90 text-white text-[10px] font-semibold px-2 py-0.5 shadow-sm">
              Updated
            </span>
          </div>
        )}
        {promotion.verificationStatus === 'gone' && (
          <div className="absolute top-2 left-2">
            <span className="badge bg-error/90 text-white text-[10px] font-semibold px-2 py-0.5 shadow-sm">
              Ended
            </span>
          </div>
        )}

        {/* End date pill — top right, overlaid on image */}
        {endLabel && (
          <div className="absolute top-2 right-2">
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm',
                expired
                  ? 'bg-black/40 text-white/70'
                  : expiringSoon
                    ? 'bg-orange-500/90 text-white'
                    : 'bg-black/50 text-white',
              )}
            >
              {endLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-1.5">
        {/* Brand name */}
        <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
          {promotion.brand.name}
        </span>

        {/* Promotion name */}
        <h3 className="text-sm font-semibold text-ink-primary leading-snug line-clamp-2">
          {promotion.name}
        </h3>

        {/* Description */}
        {promotion.description && (
          <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2 mt-0.5">
            {truncate(promotion.description, 110)}
          </p>
        )}

        {/* Footer — view deal link */}
        <div className="mt-auto pt-3">
          <a
            href={promotion.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
            aria-label={`View ${promotion.name} at source`}
          >
            View deal
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
