'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext, type Ctx } from '@/lib/context';
import { str } from '@/lib/guards';

function assertModerator(ctx: Ctx, teamId: string) {
  if (!ctx.isAdmin && !ctx.moderates.some((t) => t.id === teamId)) {
    throw new Error('You can only review the team you moderate.');
  }
}

async function assertOpen(teamId: string, date: string, ctx: Ctx) {
  const { data } = await db().from('scorecards').select('status').eq('team_id', teamId).eq('score_date', date).maybeSingle();
  if (data?.status === 'verified' && !ctx.isAdmin) throw new Error('This scorecard is already verified.');
}

async function reviewEntryImpl(form: FormData) {
  const ctx = await getContext();
  const d = db();
  const { data: entry } = await d.from('entries').select('*').eq('id', str(form, 'entry_id')).maybeSingle();
  if (!entry) throw new Error('Entry not found.');
  assertModerator(ctx, entry.team_id);
  await assertOpen(entry.team_id, entry.entry_date, ctx);
  if (entry.participant_id === ctx.me.id) throw new Error('You can’t review your own entry.');

  const decision = str(form, 'decision');
  if (!['verified', 'rejected', 'flagged'].includes(decision)) throw new Error('Choose verify, reject or flag.');
  const note = str(form, 'note').slice(0, 500) || null;
  if (decision === 'flagged' && !note) throw new Error('Add a short note so the admin knows what looks wrong.');

  const { error } = await d
    .from('entries')
    .update({ status: decision, review_note: note, reviewed_by: ctx.me.id, reviewed_at: new Date().toISOString() })
    .eq('id', entry.id);
  if (error) {
    console.error('[reviewEntry]', error);
    throw new Error('Could not save the review. Try again.');
  }
  revalidatePath('/', 'layout');
}

async function reviewGroupWorkoutImpl(form: FormData) {
  const ctx = await getContext();
  const d = db();
  const { data: gw } = await d.from('group_workouts').select('*').eq('id', str(form, 'group_workout_id')).maybeSingle();
  if (!gw) throw new Error('Group workout not found.');
  assertModerator(ctx, gw.team_id);
  await assertOpen(gw.team_id, gw.workout_date, ctx);
  const decision = str(form, 'decision');
  if (!['verified', 'rejected', 'flagged'].includes(decision)) throw new Error('Choose verify, reject or flag.');
  const note = str(form, 'note').slice(0, 500) || null;
  if (decision === 'flagged' && !note) throw new Error('Add a short note so the admin knows what looks wrong.');
  const { error } = await d
    .from('group_workouts')
    .update({ status: decision, review_note: note, reviewed_by: ctx.me.id, reviewed_at: new Date().toISOString() })
    .eq('id', gw.id);
  if (error) {
    console.error('[reviewGroupWorkout]', error);
    // Most likely cause: migration 0002 (group workout flags) hasn't been run yet.
    throw new Error(decision === 'flagged' ? 'Could not flag this group workout. Ask the admin to run the 0002 database update.' : 'Could not save the review. Try again.');
  }
  revalidatePath('/', 'layout');
}

async function completeScorecardImpl(form: FormData) {
  const ctx = await getContext();
  const teamId = str(form, 'team_id');
  const date = str(form, 'date');
  assertModerator(ctx, teamId);
  const d = db();
  const [{ count: pending }, { data: gw }] = await Promise.all([
    d.from('entries').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('entry_date', date).eq('status', 'pending'),
    d.from('group_workouts').select('status').eq('team_id', teamId).eq('workout_date', date).maybeSingle(),
  ]);
  if ((pending ?? 0) > 0 || gw?.status === 'pending') throw new Error('Review every entry before completing the scorecard.');
  await must(d
    .from('scorecards')
    .update({ status: 'verified', verified_by: ctx.me.id, verified_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('score_date', date));
  revalidatePath('/', 'layout');
}

export const reviewEntry = safe(reviewEntryImpl);
export const reviewGroupWorkout = safe(reviewGroupWorkoutImpl);
export const completeScorecard = safe(completeScorecardImpl);
