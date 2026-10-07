import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const DENVER_TZ = 'America/Denver';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ,
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function isExpiringSoon(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const msLeft = new Date(endDate).getTime() - Date.now();
  return msLeft > 0 && msLeft < 3 * 24 * 60 * 60 * 1000; // within 3 days
}

export function isExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}
