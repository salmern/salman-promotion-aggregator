'use client';
import type { VerificationReport as Report, VerificationDiscrepancy } from '@promotions/shared';
import { cn, formatDate } from '../lib/utils';

interface Props {
  report: Report;
  onDismiss: () => void;
}

export function VerificationReport({ report, onDismiss }: Props) {
  const isClean = report.result === 'clean';

  return (
    <div className="bg-white border-b border-surface-tertiary shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Summary row ─────────────────────────────────────────────────── */}
        <div className="py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {/* Status indicator dot */}
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isClean ? 'bg-[#30d158]' : 'bg-[#ff9f0a]',
            )} />

            {isClean ? (
              <p className="text-sm text-ink-primary">
                <span className="font-medium">All clear.</span>
                <span className="text-ink-secondary ml-1.5">
                  {report.checkedCount} promotions verified against source
                </span>
                {report.completedAt && (
                  <span className="text-ink-tertiary ml-1.5 hidden sm:inline">
                    · {formatDate(report.completedAt)}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-ink-primary">
                <span className="font-medium">
                  {report.discrepancyCount} {report.discrepancyCount === 1 ? 'issue' : 'issues'} found.
                </span>
                <span className="text-ink-secondary ml-1.5">
                  {report.checkedCount} promotions checked
                </span>
                {report.completedAt && (
                  <span className="text-ink-tertiary ml-1.5 hidden sm:inline">
                    · {formatDate(report.completedAt)}
                  </span>
                )}
              </p>
            )}
          </div>

          <button
            onClick={onDismiss}
            className="w-6 h-6 flex items-center justify-center rounded-full
                       text-ink-tertiary hover:text-ink-secondary hover:bg-surface-secondary
                       transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Discrepancy list (only shown when drift found) ───────────────── */}
        {!isClean && report.discrepancies.length > 0 && (
          <div className="border-t border-surface-tertiary pb-3">
            <div className="divide-y divide-surface-tertiary">
              {report.discrepancies.map((disc) => (
                <DiscrepancyRow key={disc.id} disc={disc} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function DiscrepancyRow({ disc }: { disc: VerificationDiscrepancy }) {
  const isGone = disc.discrepancyType === 'gone';
  const isUnverifiable = disc.discrepancyType === 'unverifiable';
  const isChanged = disc.discrepancyType === 'changed';

  return (
    <div className="py-2.5 flex items-start gap-4">

      {/* Type label — fixed width, right-aligned */}
      <span className={cn(
        'shrink-0 text-[10px] font-semibold uppercase tracking-wider pt-0.5 w-20 text-right',
        isGone ? 'text-error' : isUnverifiable ? 'text-ink-tertiary' : 'text-[#ff9f0a]',
      )}>
        {isGone ? 'Gone' : isUnverifiable ? 'Unknown' : 'Changed'}
      </span>

      {/* Divider */}
      <div className="w-px self-stretch bg-surface-tertiary shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1 py-0.5">
        {/* Name + field */}
        <p className="text-sm font-medium text-ink-primary truncate">
          {disc.promotionName ?? 'Unknown'}
          {disc.fieldName && (
            <span className="font-normal text-ink-tertiary ml-2 text-xs">
              {disc.fieldName}
            </span>
          )}
        </p>

        {/* Before → After for changed */}
        {isChanged && (disc.beforeValue || disc.afterValue) && (
          <div className="flex items-start gap-2 text-xs text-ink-secondary">
            <span className="shrink-0 font-mono bg-surface-secondary rounded px-1.5 py-0.5 line-through text-ink-tertiary max-w-[220px] truncate">
              {formatValue(disc.beforeValue ?? '—')}
            </span>
            <svg className="w-3 h-3 shrink-0 mt-0.5 text-ink-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="shrink-0 font-mono bg-surface-secondary rounded px-1.5 py-0.5 text-ink-primary max-w-[220px] truncate">
              {formatValue(disc.afterValue ?? '—')}
            </span>
          </div>
        )}

        {/* Gone — just the URL */}
        {isGone && (
          <p className="text-xs text-ink-tertiary truncate font-mono">
            {disc.beforeValue ?? disc.promotionName}
          </p>
        )}

        {/* Unverifiable reason */}
        {isUnverifiable && disc.reason && (
          <p className="text-xs text-ink-tertiary truncate">
            {disc.reason.split('\n')[0]}
          </p>
        )}
      </div>
    </div>
  );
}

function formatValue(val: string): string {
  // ISO date → readable Denver time
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        month: 'short', day: 'numeric', year: 'numeric',
      }).format(new Date(val));
    } catch { /* fall through */ }
  }
  // Hours raw — strip label and unicode joiners, collapse newlines
  const cleaned = val
    .replace(/\u2060|\u200b|\u200c|\u200d/g, '')
    .replace(/^Hours:\s*/i, '')
    .replace(/\n+/g, ' · ')
    .trim();
  return cleaned.length > 60 ? cleaned.slice(0, 57) + '…' : cleaned;
}
