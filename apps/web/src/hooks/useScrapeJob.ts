'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { ScrapeJobStatus } from '@promotions/shared';

type ScrapeState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'polling'; jobId: string; status: ScrapeJobStatus }
  | { phase: 'cancelling'; jobId: string; status: ScrapeJobStatus }
  | { phase: 'done'; jobId: string; status: ScrapeJobStatus }
  | { phase: 'error'; message: string };

export function useScrapeJob(onComplete?: () => void) {
  const [state, setState] = useState<ScrapeState>({ phase: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startScrape = useCallback(async () => {
    setState({ phase: 'starting' });
    try {
      const { jobId } = await api.scrape.start();
      setState({ phase: 'polling', jobId, status: { jobId, state: 'waiting', counts: { attempted: 0, persisted: 0, updated: 0, skipped: 0, failed: 0 }, failedReason: null, createdAt: null, processedAt: null, finishedAt: null } });

      pollRef.current = setInterval(async () => {
        try {
          const status = await api.scrape.status(jobId);
          // Keep polling but transition to cancelling state if cancel was requested
          const currentPhase = (s: ScrapeState) =>
            s.phase === 'cancelling' ? 'cancelling' : 'polling';
          setState((prev) => {
            const phase = prev.phase === 'cancelling' ? 'cancelling' : 'polling';
            return { phase, jobId, status };
          });
          if (status.state === 'completed' || status.state === 'failed' || status.state === 'cancelled') {
            stopPolling();
            setState({ phase: 'done', jobId, status });
            if (status.state === 'completed') onComplete?.();
          }
        } catch {
          stopPolling();
          setState({ phase: 'error', message: 'Failed to poll job status' });
        }
      }, 3000);
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to start scrape' });
    }
  }, [stopPolling, onComplete]);

  const cancelScrape = useCallback(async (jobId: string) => {
    // Immediately show cancelling state — gives instant feedback.
    // The worker will stop after its current promotion (cooperative cancellation).
    // The polling interval continues and will catch the final 'cancelled' state.
    setState((prev) => {
      if (prev.phase === 'polling') {
        return { phase: 'cancelling', jobId: prev.jobId, status: prev.status };
      }
      return prev;
    });
    try {
      await api.scrape.cancel(jobId);
    } catch {
      // ignore cancel errors — state will resolve when polling catches the final status
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setState({ phase: 'idle' });
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { state, startScrape, cancelScrape, reset };
}
