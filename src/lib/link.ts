import 'server-only';
import { revalidateTag } from 'next/cache';
import { db } from './supabase/admin';
import { getActiveChallenge, PEOPLE_TAG } from './cached';

// Links a newly signed-in account to the participant with the same email (first sign-in only).
// Called from the sign-in callback and code check, where revalidateTag is allowed.
export async function linkParticipant(userId: string, email: string | undefined | null) {
  if (!email) return;
  const challenge = await getActiveChallenge();
  if (!challenge) return;
  const { data, error } = await db()
    .from('participants')
    .update({ user_id: userId })
    .eq('challenge_id', challenge.id)
    .eq('email', email.toLowerCase())
    .is('user_id', null)
    .select('id');
  if (error) console.error('[linkParticipant]', error);
  if (data?.length) revalidateTag(PEOPLE_TAG);
}
