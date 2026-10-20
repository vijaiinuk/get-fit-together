import 'server-only';
import type { Ctx } from './context';
import { db } from './supabase/admin';

// Checks that a proof path was created by this user for this challenge.
export function assertOwnProofPath(ctx: Ctx, path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith(`${ctx.challenge.id}/${ctx.me.id}/`)) {
    throw new Error('Add a proof screenshot or photo first.');
  }
  return path;
}

// Same as assertOwnProofPath, and also checks the file really was uploaded to the bucket.
export async function assertUploadedProof(ctx: Ctx, path: unknown): Promise<string> {
  const p = assertOwnProofPath(ctx, path);
  const { data, error } = await db().storage.from('proofs').exists(p);
  if (error || !data) throw new Error('The proof upload didn’t finish. Add the screenshot or photo again.');
  return p;
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function int(form: FormData, key: string): number {
  const n = Number(str(form, key));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}
