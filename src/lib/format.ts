import type { EntryScore } from './types';

export function formatQuantity(unit: 'minutes' | 'steps', quantity: number): string {
  return unit === 'steps' ? `${quantity.toLocaleString('en-GB')} steps` : `${quantity} min`;
}

export function thresholdLabel(unit: 'minutes' | 'steps', threshold: number): string {
  return unit === 'steps' ? `${threshold.toLocaleString('en-GB')} steps` : `${threshold} min`;
}

export function entryStatusLabel(e: Pick<EntryScore, 'status' | 'quantity' | 'threshold' | 'unit'>): {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted' | 'info';
} {
  if (e.quantity < e.threshold) return { label: `Below ${thresholdLabel(e.unit, e.threshold)}`, tone: 'muted' };
  switch (e.status) {
    case 'verified':
      return { label: 'Verified', tone: 'ok' };
    case 'rejected':
      return { label: 'Rejected', tone: 'bad' };
    case 'flagged':
      return { label: 'Flagged for admin', tone: 'warn' };
    default:
      return { label: 'Awaiting verification', tone: 'info' };
  }
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
