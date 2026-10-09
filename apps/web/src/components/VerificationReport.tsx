'use client';
import type { VerificationReport as Report, VerificationDiscrepancy } from '@promotions/shared';
import { cn, formatDate } from '../lib/utils';

interface Props {
  report: Report;
  onDismiss: () => void;
}

export function VerificationReport({ report, onDismiss }: Props) {
  const isClean = report.result === 'clean';

  if (isClean) {
    // Clean — compact green bar, dismisses itself
    return (
      <div className="bg-green-50 border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-green-700">
                All {report.checkedCount} promotions verified — data matches the source
              </p>
              <span className="text-xs text-green-500 hidden sm:inline">
                · {formatDate(report.completedAt)}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="text-green-400 hover:text-green-600 transition-colors shrink-0 focus:outline-none"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Drift detected — show full discrepancy list
  const gone = report.discrepancies.filter((d) => d.discrepancyType === 'gone');
  const changed = report.discrepancies.filter((d) => d.discrepancyType === 'changed');
  const unverifiable = report.discrepancies.filter((d) => d.discrepancyType === 'unverifiable');

  return (
    <div className="bg-amber-50 border-b border-amber-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-amber-800">
              Verification found {report.discrepancyCount} issue{report.discrepancyCount !== 1 ? 's' : ''}
              <span className="font-normal text-amber-600 ml-1.5">
                · {report.checkedCount} promotions checked · {formatDate(report.completedAt)}
              </span>
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 focus:outline-none"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Discrepancy list */}
        <div className="space-y-1.5">
          {/* Gone */}
          {gone.map((d) => (
            <DiscrepancyRow key={d.id} disc={d} />
          ))}
          {/* Changed */}
          {changed.map((d) => (
            <DiscrepancyRow key={d.id} disc={d} />
          ))}
          {/* Unverifiable */}
          {unverifiable.map((d) => (
            <DiscrepancyRow key={d.id} disc={d} />
          ))}
        </div>

      </div>
    </div>
  );
}

function DiscrepancyRow({ disc }: { disc: VerificationDiscrepancy }) {
  const isGone = disc.discrepancyType === 'gone';
  const isUnverifiable = disc.discrepancyType === 'unverifiable';

  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 px-3 py-2.5 rounded-xl text-xs',
      isGone
        ? 'bg-red-50 border border-red-100'
        : isUnverifiable
          ? 'bg-surface-secondary border border-surface-tertiary'
          : 'bg-white border border-amber-100',
    )}>
      {/* Type badge */}
      <span className={cn(
        'shrink-0 font-semibold px-2 py-0.5 rounded-full text-[10px] self-start mt-0.5',
        isGone
          ? 'bg-red-100 text-red-700'
          : isUnverifiable
            ? 'bg-surface-tertiary text-ink-tertiary'
            : 'bg-amber-100 text-amber-700',
      )}>
        {isGone ? 'Gone' : isUnverifiable ? 'Unverifiable' : 'Changed'}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Promotion / brand name */}
        <p className="font-semibold text-ink-primary truncate">
          {disc.promotionName ?? 'Unknown'}
          {disc.fieldName && (
            <span className="font-normal text-ink-secondary ml-1.5">· {disc.fieldName}</span>
          )}
        </p>

        {/* Before / After for changed */}
        {disc.discrepancyType === 'changed' && disc.beforeValue && (
          <div className="space-y-0.5">
            <p className="text-ink-tertiary">
              <span className="text-red-500 font-medium">Before:</span>{' '}
              <span className="font-mono">{truncateValue(disc.beforeValue)}</span>
            </p>
            <p className="text-ink-tertiary">
              <span className="text-green-600 font-medium">After:</span>{' '}
              <span className="font-mono">{truncateValue(disc.afterValue ?? '—')}</span>
            </p>
          </div>
        )}

        {/* Gone reason */}
        {isGone && (
          <p className="text-red-600">No longer exists at source</p>
        )}

        {/* Unverifiable reason */}
        {isUnverifiable && disc.reason && (
          <p className="text-ink-tertiary truncate">{disc.reason.split('\n')[0]}</p>
        )}
      </div>
    </div>
  );
}

function truncateValue(val: string): string {
  // For ISO dates, format nicely
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      }).format(new Date(val));
    } catch { /* fall through */ }
  }
  // Clean up hours raw strings — normalize unicode joiners and collapse whitespace
  const cleaned = val
    .replace(/\u2060|\u200b|\u200c|\u200d/g, '') // zero-width chars
    .replace(/Mon\s*[–-]\s*Sat/g, 'Mon–Sat')
    .replace(/Sun:/g, ' · Sun:')
    .replace(/\n+/g, ' · ')
    .replace(/^Hours:\s*/i, '')
    .trim();
  // Truncate long strings
  return cleaned.length > 80 ? cleaned.slice(0, 77) + '…' : cleaned;
}
