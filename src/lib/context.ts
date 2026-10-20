import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createAuthClient } from './supabase/server';
import { db } from './supabase/admin';
import { localDate } from './dates';
import type { Challenge, Participant, Team } from './types';

export type Ctx = {
  userId: string;
  email: string | null;
  challenge: Challenge;
  me: Participant;
  teams: Team[];
  myTeam: Team | null;
  isAdmin: boolean;
  captainOf: Team | null;
  moderates: Team[];
  today: string;
};

// Works out who is signed in, which participant they are, and what roles they hold.
// The first time someone signs in, their account is linked to the participant with their email.
export const getContext = cache(async (): Promise<Ctx> => {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) redirect('/login');

  const d = db();
  const { data: challenge } = await d
    .from('challenges')
    .select('*')
    .eq('is_active', true)
    .order('starts_on', { ascending: false })
    .limit(1)
    .maybeSingle<Challenge>();
  if (!challenge) redirect('/not-on-list');

  const email = user.email?.toLowerCase() ?? null;
  let { data: me } = await d
    .from('participants')
    .select('*')
    .eq('challenge_id', challenge.id)
    .eq('user_id', user.id)
    .maybeSingle<Participant>();

  if (!me && email) {
    const { data: match } = await d
      .from('participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('email', email)
      .is('user_id', null)
      .maybeSingle<Participant>();
    if (match) {
      await d.from('participants').update({ user_id: user.id }).eq('id', match.id);
      me = { ...match, user_id: user.id };
    }
  }
  if (!me) redirect('/not-on-list');

  const { data: teamRows } = await d
    .from('teams')
    .select('*')
    .eq('challenge_id', challenge.id)
    .order('name');
  const teams = (teamRows ?? []) as Team[];
  const meId = me.id;

  return {
    userId: user.id,
    email,
    challenge,
    me,
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
