import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createAuthClient } from './supabase/server';
import { db } from './supabase/admin';
import { getActiveChallenge, getParticipants, getTeams } from './cached';
import { localDate } from './dates';
import type { Challenge, Participant, Team } from './types';

export type Ctx = {
  userId: string;
  email: string | null;
  challenge: Challenge;
  me: Participant;
  people: Participant[];
  teams: Team[];
  myTeam: Team | null;
  isAdmin: boolean;
  captainOf: Team | null;
  moderates: Team[];
  today: string;
};

// Works out who is signed in, which participant they are, and what roles they hold.
// Uses getClaims(): with asymmetric JWT signing keys it verifies the session locally, without a
// round trip to Supabase Auth. With the legacy shared secret it falls back to asking the server.
export const getContext = cache(async (): Promise<Ctx> => {
  const auth = await createAuthClient();
  const { data: claimsData } = await auth.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect('/login');
  const email = typeof claimsData?.claims.email === 'string' ? claimsData.claims.email.toLowerCase() : null;

  const challenge = await getActiveChallenge();
  if (!challenge) redirect('/not-on-list');

  const [teams, people] = await Promise.all([getTeams(challenge.id), getParticipants(challenge.id)]);
  let me = people.find((p) => p.user_id === userId) ?? null;

  if (!me) {
    // Not in the cached list yet (first sign-in, or the cache is a few minutes old): ask the database.
    const d = db();
    const { data: byUser } = await d
      .from('participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', userId)
      .maybeSingle<Participant>();
    me = byUser;
    if (!me && email) {
      const { data: match } = await d
        .from('participants')
        .select('*')
        .eq('challenge_id', challenge.id)
        .eq('email', email)
        .is('user_id', null)
        .maybeSingle<Participant>();
      if (match) {
        await d.from('participants').update({ user_id: userId }).eq('id', match.id);
        me = { ...match, user_id: userId };
      }
    }
  }
  if (!me) redirect('/not-on-list');
  const meId = me.id;

  return {
    userId,
    email,
    challenge,
    me,
    people,
    teams,
    myTeam: teams.find((t) => t.id === me!.team_id) ?? null,
    isAdmin: me.is_admin,
    captainOf: teams.find((t) => t.captain_id === meId) ?? null,
    moderates: teams.filter((t) => t.moderator_id === meId),
    today: localDate(challenge.timezone),
  };
});

export async function requireAdmin(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx.isAdmin) redirect('/');
  return ctx;
}
