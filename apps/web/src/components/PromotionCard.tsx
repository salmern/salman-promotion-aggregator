'use client';
import Image from 'next/image';
import type { Promotion } from '@promotions/shared';
import { formatDateShort, isExpiringSoon, isExpired, truncate, cn } from '../lib/utils';

interface Props {
  promotion: Promotion;
}

export function PromotionCard({ promotion }: Props) {
  const expired = isExpired(promotion.endDate);
  const expiringSoon = isExpiringSoon(promotion.endDate);

  return (
    <article
      className={cn(
        'card group flex flex-col overflow-hidden',
        expired && 'opacity-60',
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
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-20">🏷️</span>
          </div>
        )}

        {/* Verification badge */}
        {promotion.verificationStatus === 'changed' && (
          <div className="absolute top-2 left-2">
            <span className="badge bg-warning/20 text-warning border border-warning/30">
              ⚡ Updated
            </span>
          </div>
        )}
        {promotion.verificationStatus === 'gone' && (
          <div className="absolute top-2 left-2">
            <span className="badge bg-error/20 text-error border border-error/30">
              ✕ Ended
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Brand pill */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">
            {promotion.brand.name}
          </span>
          {/* End date badge */}
          {promotion.endDate && (
            <span
              className={cn(
                'badge text-xs',
                expired
                  ? 'bg-surface-tertiary text-ink-tertiary'
                  : expiringSoon
                    ? 'bg-warning/10 text-warning'
                    : 'bg-surface-secondary text-ink-secondary',
              )}
            >
              {expired ? 'Ended' : `Ends ${formatDateShort(promotion.endDate)}`}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-ink-primary leading-snug">
          {promotion.name}
        </h3>

        {/* Description */}
        {promotion.description && (
          <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">
            {truncate(promotion.description, 120)}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <a
            href={promotion.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
            aria-label={`View ${promotion.name} at source`}
          >
            View deal →
          </a>
        </div>
      </div>
    </article>
  );
}
