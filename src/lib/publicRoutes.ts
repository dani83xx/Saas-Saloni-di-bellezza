export type PublicLegalPath = 'privacy' | 'termini';

/** Path pubblici della SPA. Vercel deve riscrivere queste rotte su index.html. */
export function readPublicLegalPath(pathname?: string): PublicLegalPath | null {
  const raw = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const path = raw.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return 'privacy';
  if (path === '/termini') return 'termini';
  return null;
}
