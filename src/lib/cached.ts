import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './supabase/admin';
import type { ActivityType, Challenge, Participant, Team } from './types';

// Data that only admins change, cached across requests so most pages skip 3-4 database round trips.
// Admin actions call revalidateTag(...) so changes show up immediately. The 5-minute expiry is a
// safety net for edits made directly in the Supabase dashboard.
export const CONFIG_TAG = 'config'; // challenge settings, teams, captains, moderators, activity types
export const PEOPLE_TAG = 'participants'; // names, emails, teams, admin flag, who has signed in
const TTL = 300;

async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message); // errors are not cached
  return data as T;
}

export const getActiveChallenge = unstable_cache(
  () =>
    rows<Challenge | null>(
      db().from('challenges').select('*').eq('is_active', true).order('starts_on', { ascending: false }).limit(1).maybeSingle(),
    ),
  ['active-challenge'],
  { tags: [CONFIG_TAG], revalidate: TTL },
);

export const getTeams = unstable_cache(
  (challengeId: string) => rows<Team[]>(db().from('teams').select('*').eq('challenge_id', challengeId).order('name')),
  ['teams'],
  { tags: [CONFIG_TAG], revalidate: TTL },
);

// All activity types, including disabled ones. Filter on `enabled` where needed.
export const getActivityTypes = unstable_cache(
  (challengeId: string) =>
    rows<ActivityType[]>(db().from('activity_types').select('*').eq('challenge_id', challengeId).order('sort').order('name')),
  ['activity-types'],
  { tags: [CONFIG_TAG], revalidate: TTL },
);

export const getParticipants = unstable_cache(
  (challengeId: string) =>
    rows<Participant[]>(db().from('participants').select('*').eq('challenge_id', challengeId).order('display_name')),
  ['participants'],
  { tags: [PEOPLE_TAG], revalidate: TTL },
);
