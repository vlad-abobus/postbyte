import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | any): string {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function isGifImage(url?: string | null, filename?: string | null): boolean {
  const name = (filename || '').trim().toLowerCase();
  if (name.endsWith('.gif')) return true;
  const rawUrl = (url || '').trim();
  if (!rawUrl) return false;
  try {
    const pathname = new URL(rawUrl, 'http://localhost').pathname.toLowerCase();
    return pathname.endsWith('.gif');
  } catch {
    return /\.gif(\?|#|$)/i.test(rawUrl);
  }
}

export function extractFilenameFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'animation.gif';
  } catch {
    return 'animation.gif';
  }
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
