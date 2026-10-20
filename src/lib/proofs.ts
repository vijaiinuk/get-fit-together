'use server';

import { db } from './supabase/admin';
import { getContext } from './context';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Creates a one-time signed upload URL. The browser uploads the compressed image straight
// to Supabase Storage with it, then sends the returned path along with the form.
export async function createProofUpload(
  contentType: string = 'image/jpeg',
): Promise<{ path: string; token: string } | { error: string }> {
  const ctx = await getContext();
  const ext = EXT[contentType];
  if (!ext) return { error: 'Use a JPEG, PNG or WebP image.' };
  const path = `${ctx.challenge.id}/${ctx.me.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { data, error } = await db().storage.from('proofs').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[proofs] createSignedUploadUrl failed', error);
    return { error: 'Could not start the upload. Try again.' };
  }
  return { path: data.path, token: data.token };
}
