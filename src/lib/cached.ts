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

// Signed links to profile pictures, cached for 6 days (links last 7), so each picture keeps the same
// URL and browsers can cache it instead of downloading it on every page.
const signAvatar = unstable_cache(
  async (path: string) => {
    const { data, error } = await db().storage.from('avatars').createSignedUrl(path, 7 * 24 * 60 * 60);
    if (error || !data) throw new Error(error?.message ?? 'Could not sign avatar');
    return data.signedUrl;
  },
  ['avatar-url'],
  { revalidate: 6 * 24 * 60 * 60 },
);

// Turns a database row into what the app shows: alias in place of the name, real name kept in full_name.
export function toParticipant(row: Participant): Participant {
  const alias = row.alias?.trim() || null;
  return { ...row, alias, full_name: row.display_name, display_name: alias ?? row.display_name };
}

export const getParticipants = unstable_cache(
  async (challengeId: string): Promise<Participant[]> => {
    const raw = await rows<Participant[]>(
      db().from('participants').select('*').eq('challenge_id', challengeId).order('display_name'),
    );
    return Promise.all(
      raw.map(async (r) => ({
        ...toParticipant(r),
        avatar_url: r.avatar_path ? await signAvatar(r.avatar_path).catch(() => null) : null,
      })),
    );
  },
  ['participants'],
  { tags: [PEOPLE_TAG], revalidate: TTL },
);
