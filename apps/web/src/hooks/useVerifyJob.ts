'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import type { VerificationReport } from '@promotions/shared';

type VerifyState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'polling'; runId: number; checkedCount: number; total: number }
  | { phase: 'done'; report: VerificationReport }
  | { phase: 'error'; message: string };

export function useVerifyJob() {
  const [state, setState] = useState<VerifyState>({ phase: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startVerify = useCallback(async () => {
    setState({ phase: 'starting' });
    try {
      const { runId } = await api.verify.start();
      setState({ phase: 'polling', runId, checkedCount: 0, total: 0 });

      pollRef.current = setInterval(async () => {
        try {
          const report = await api.verify.report(runId);
          if (report.status === 'running') {
            setState({ phase: 'polling', runId, checkedCount: report.checkedCount, total: report.checkedCount });
            return;
          }
          stopPolling();
          setState({ phase: 'done', report });
        } catch {
          stopPolling();
          setState({ phase: 'error', message: 'Failed to poll verification status' });
        }
      }, 3000);
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to start verification' });
    }
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState({ phase: 'idle' });
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { state, startVerify, reset };
}
