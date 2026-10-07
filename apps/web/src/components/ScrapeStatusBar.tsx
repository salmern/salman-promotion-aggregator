'use client';
import { cn } from '../lib/utils';

interface ScrapeState {
  phase: 'idle' | 'starting' | 'polling' | 'done' | 'error';
  jobId?: string;
  counts?: { attempted: number; persisted: number; updated: number; failed: number };
  jobState?: string;
  message?: string;
}

interface Props {
  state: ScrapeState;
  onStart: () => void;
  onCancel: (jobId: string) => void;
  onReset: () => void;
}

export function ScrapeStatusBar({ state, onStart, onCancel, onReset }: Props) {
  const isRunning = state.phase === 'polling' || state.phase === 'starting';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {state.phase === 'idle' && (
        <button onClick={onStart} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now
        </button>
      )}

      {state.phase === 'starting' && (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Starting scrape…
        </div>
      )}

      {state.phase === 'polling' && state.jobId && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span className="text-ink-secondary">
              Scraping…
              {state.counts && (
                <span className="ml-1 font-medium text-ink-primary">
                  {state.counts.persisted} new, {state.counts.updated} updated
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => onCancel(state.jobId!)}
            className="btn-secondary !px-3 !py-1.5 !text-xs text-error hover:text-error"
          >
            Cancel
          </button>
        </div>
      )}

      {state.phase === 'done' && (
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center gap-2 text-sm',
            state.jobState === 'completed' ? 'text-success' :
            state.jobState === 'cancelled' ? 'text-warning' : 'text-error',
          )}>
            {state.jobState === 'completed' ? '✓' : state.jobState === 'cancelled' ? '◌' : '✕'}
            <span>
              {state.jobState === 'completed'
                ? `Done — ${state.counts?.persisted ?? 0} new, ${state.counts?.updated ?? 0} updated`
                : state.jobState === 'cancelled' ? 'Cancelled'
                : 'Failed'}
            </span>
          </div>
          <button onClick={onReset} className="btn-secondary !px-3 !py-1.5 !text-xs">
            Dismiss
          </button>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-error">{state.message ?? 'Error'}</span>
          <button onClick={onReset} className="btn-secondary !px-3 !py-1.5 !text-xs">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
