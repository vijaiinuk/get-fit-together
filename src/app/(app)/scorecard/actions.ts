'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext, type Ctx } from '@/lib/context';
import { assertUploadedProof, int, str } from '@/lib/guards';
import type { ActivityType, Team } from '@/lib/types';

function teamFor(ctx: Ctx, teamId: string): Team {
  const team = ctx.teams.find((t) => t.id === teamId);
  if (!team) throw new Error('Team not found.');
  if (ctx.captainOf?.id !== team.id && !ctx.isAdmin) throw new Error('Only the team captain can change this scorecard.');
  return team;
}

function done() {
  revalidatePath('/', 'layout');
}

// Captain corrects the activity or amount on a teammate's pending entry.
async function updateEntryImpl(form: FormData) {
  const ctx = await getContext();
  const d = db();
  const { data: entry } = await d.from('entries').select('*').eq('id', str(form, 'entry_id')).maybeSingle();
  if (!entry) throw new Error('Entry not found.');
  teamFor(ctx, entry.team_id);
  if (entry.entry_date !== ctx.today) throw new Error('Only today’s entries can be changed.');
  if (entry.status !== 'pending') throw new Error('This entry has already been reviewed.');

  const { data: type } = await d.from('activity_types').select('*').eq('id', str(form, 'activity_type_id')).maybeSingle<ActivityType>();
  if (!type || type.challenge_id !== ctx.challenge.id) throw new Error('Choose an activity.');
  const quantity = int(form, 'quantity');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Enter a number above zero.');

  await must(d.from('entries').update({ activity_type_id: type.id, quantity }).eq('id', entry.id));
  done();
}

async function createGroupWorkoutImpl(form: FormData) {
  const ctx = await getContext();
  const team = teamFor(ctx, str(form, 'team_id'));
  const d = db();
  const description = str(form, 'description').slice(0, 200);
  if (!description) throw new Error('Describe the group workout, for example “Park walk together”.');
  const ids = Array.from(new Set(form.getAll('participant_ids').map(String)));
  const { data: members } = await d.from('participants').select('id').eq('team_id', team.id).in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const valid = (members ?? []).map((m) => m.id);
  if (valid.length < ctx.challenge.group_min_members) {
    throw new Error(`A group workout needs at least ${ctx.challenge.group_min_members} teammates. You selected ${valid.length}.`);
  }
  const proofPath = await assertUploadedProof(ctx, form.get('proof_path'));

  const { data: gw, error } = await d
    .from('group_workouts')
    .insert({ team_id: team.id, workout_date: ctx.today, description, proof_path: proofPath, created_by: ctx.me.id })
    .select('id')
    .single();
  if (error || !gw) throw new Error('There is already a group workout for today. Remove it first to add a new one.');
  const { error: membersError } = await d
    .from('group_workout_participants')
    .insert(valid.map((id) => ({ group_workout_id: gw.id, participant_id: id })));
  if (membersError) {
    // Don't leave a group workout with nobody on it, which would block adding a new one today.
    console.error('[createGroupWorkout]', membersError);
    await d.from('group_workouts').delete().eq('id', gw.id);
    throw new Error('Could not save who took part. Try again.');
  }
  done();
}

async function deleteGroupWorkoutImpl(form: FormData) {
  const ctx = await getContext();
  const d = db();
  const { data: gw } = await d.from('group_workouts').select('*').eq('id', str(form, 'group_workout_id')).maybeSingle();
  if (!gw) return;
  teamFor(ctx, gw.team_id);
  if (gw.status !== 'pending') throw new Error('This group workout has already been reviewed.');
  await must(d.from('group_workouts').delete().eq('id', gw.id));
  done();
}

async function submitScorecardImpl(form: FormData) {
  const ctx = await getContext();
  const team = teamFor(ctx, str(form, 'team_id'));
  const { error } = await db().from('scorecards').upsert(
    {
      team_id: team.id,
      score_date: ctx.today,
      status: 'submitted',
      submitted_by: ctx.me.id,
      submitted_at: new Date().toISOString(),
      verified_by: null,
      verified_at: null,
    },
    { onConflict: 'team_id,score_date' },
  );
  if (error) throw new Error('Could not submit the scorecard. Try again.');
  done();
}

export const updateEntry = safe(updateEntryImpl);
export const createGroupWorkout = safe(createGroupWorkoutImpl);
export const deleteGroupWorkout = safe(deleteGroupWorkoutImpl);
export const submitScorecard = safe(submitScorecardImpl);
