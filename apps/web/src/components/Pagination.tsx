'use client';
import { cn } from '../lib/utils';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onChange }: Props) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-sm text-ink-secondary">
        Showing <span className="font-medium text-ink-primary">{start}–{end}</span> of{' '}
        <span className="font-medium text-ink-primary">{total}</span>
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          ←
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-ink-tertiary text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(Number(p))}
              className={cn(
                'w-9 h-9 text-sm font-medium rounded-xl transition-colors',
                p === page
                  ? 'bg-accent text-white'
                  : 'bg-white border border-surface-tertiary text-ink-secondary hover:bg-surface-secondary',
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          →
        </button>
      </nav>
    </div>
  );
}

function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
