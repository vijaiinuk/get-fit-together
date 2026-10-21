'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext } from '@/lib/context';
import { PEOPLE_TAG } from '@/lib/cached';
import { str } from '@/lib/guards';

function done() {
  revalidateTag(PEOPLE_TAG);
  revalidatePath('/', 'layout');
}

async function saveAliasImpl(form: FormData) {
  const ctx = await getContext();
  const alias = str(form, 'alias').replace(/\s+/g, ' ').slice(0, 30) || null;
  await must(db().from('participants').update({ alias }).eq('id', ctx.me.id), 'Could not save your display name. Try again.');
  done();
}

async function removeAvatarImpl() {
  const ctx = await getContext();
  const old = ctx.me.avatar_path;
  await must(db().from('participants').update({ avatar_path: null }).eq('id', ctx.me.id));
  if (old) await db().storage.from('avatars').remove([old]);
  done();
}

export const saveAlias = safe(saveAliasImpl);
export const removeAvatar = safe(removeAvatarImpl);

// One-time signed upload link for a new profile picture (same pattern as proof uploads).
export async function createAvatarUpload(): Promise<{ path: string; token: string } | { error: string }> {
  const ctx = await getContext();
  const path = `${ctx.challenge.id}/${ctx.me.id}/${Date.now()}.jpg`;
  const { data, error } = await db().storage.from('avatars').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[avatar] createSignedUploadUrl failed', error);
    return { error: 'Could not start the upload. Try again.' };
  }
  return { path: data.path, token: data.token };
}

// Called after the browser uploaded the picture: checks it, saves it, and deletes the old one.
export async function saveAvatar(path: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await getContext();
  if (typeof path !== 'string' || !path.startsWith(`${ctx.challenge.id}/${ctx.me.id}/`)) return { error: 'Upload a picture first.' };
  const store = db().storage.from('avatars');
  const { data: exists } = await store.exists(path);
  if (!exists) return { error: 'The upload didn’t finish. Try again.' };
  const old = ctx.me.avatar_path;
  const { error } = await db().from('participants').update({ avatar_path: path }).eq('id', ctx.me.id);
  if (error) {
    console.error('[avatar] save failed', error);
    return { error: 'Could not save your picture. Try again.' };
  }
  if (old && old !== path) await store.remove([old]);
  done();
  return { ok: true };
}
