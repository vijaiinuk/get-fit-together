'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/context';
import { isIsoDate } from '@/lib/dates';
import { int, str } from '@/lib/guards';

function done() {
  revalidatePath('/', 'layout');
}

async function toggleActivityImpl(form: FormData) {
  const ctx = await requireAdmin();
  const id = str(form, 'id');
  const d = db();
  const { data } = await d.from('activity_types').select('enabled, challenge_id').eq('id', id).maybeSingle();
  if (!data || data.challenge_id !== ctx.challenge.id) return;
  await must(d.from('activity_types').update({ enabled: !data.enabled }).eq('id', id));
  done();
}

async function addActivityImpl(form: FormData) {
  const ctx = await requireAdmin();
  const name = str(form, 'name').slice(0, 40);
  const unit = str(form, 'unit') === 'steps' ? 'steps' : 'minutes';
  const threshold = int(form, 'threshold');
  if (!name) throw new Error('Give the activity a name.');
  if (!Number.isFinite(threshold) || threshold <= 0) throw new Error('Set a threshold above zero.');
  const { error } = await db().from('activity_types').insert({ challenge_id: ctx.challenge.id, name, unit, threshold, sort: 100 });
  if (error) throw new Error('An activity with that name already exists.');
  done();
}

async function saveRulesImpl(form: FormData) {
  const ctx = await requireAdmin();
  const name = str(form, 'name').slice(0, 80);
  const starts = str(form, 'starts_on');
  const ends = str(form, 'ends_on');
  const timezone = str(form, 'timezone');
  const groupMin = int(form, 'group_min_members');
  const bonus = int(form, 'group_team_bonus');
  const penalty = int(form, 'fudge_penalty');
  if (!name || !isIsoDate(starts) || !isIsoDate(ends) || ends < starts) throw new Error('Check the name and dates.');
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    throw new Error('Use a timezone like Europe/London or Asia/Kolkata.');
  }
  if (!(groupMin >= 2) || !(bonus >= 0) || !(penalty >= 0)) throw new Error('Check the scoring numbers.');
  await must(db()
    .from('challenges')
    .update({ name, starts_on: starts, ends_on: ends, timezone, group_min_members: groupMin, group_team_bonus: bonus, fudge_penalty: penalty })
    .eq('id', ctx.challenge.id));
  done();
}

// Admin decides on an entry a moderator flagged.
async function resolveFlagImpl(form: FormData) {
  const ctx = await requireAdmin();
  const d = db();
  const { data: entry } = await d.from('entries').select('*').eq('id', str(form, 'entry_id')).maybeSingle();
  if (!entry || entry.challenge_id !== ctx.challenge.id) throw new Error('Entry not found.');
  const decision = str(form, 'decision');
  const now = new Date().toISOString();

  if (decision === 'penalty') {
    await must(d.from('penalties').insert({
      team_id: entry.team_id,
      points: -Math.abs(ctx.challenge.fudge_penalty),
      reason: entry.review_note ? `Fudged entry: ${entry.review_note}` : 'Fudged entry',
      entry_id: entry.id,
      issued_by: ctx.me.id,
    }));
    await must(d.from('entries').update({ status: 'rejected', reviewed_by: ctx.me.id, reviewed_at: now }).eq('id', entry.id));
  } else if (decision === 'reject') {
    await must(d.from('entries').update({ status: 'rejected', reviewed_by: ctx.me.id, reviewed_at: now }).eq('id', entry.id));
  } else if (decision === 'dismiss') {
    await must(d.from('entries').update({ status: 'verified', reviewed_by: ctx.me.id, reviewed_at: now }).eq('id', entry.id));
  }
  done();
}

// Admin decides on a group workout a moderator flagged.
async function resolveGroupFlagImpl(form: FormData) {
  const ctx = await requireAdmin();
  const d = db();
  const { data: gw } = await d.from('group_workouts').select('*').eq('id', str(form, 'group_workout_id')).maybeSingle();
  if (!gw || !ctx.teams.some((t) => t.id === gw.team_id)) throw new Error('Group workout not found.');
  const decision = str(form, 'decision');
  if (!['penalty', 'reject', 'dismiss'].includes(decision)) throw new Error('Choose what to do with the flag.');
  const now = new Date().toISOString();

  if (decision === 'penalty') {
    await must(d.from('penalties').insert({
      team_id: gw.team_id,
      points: -Math.abs(ctx.challenge.fudge_penalty),
      reason: gw.review_note ? `Fudged group workout: ${gw.review_note}` : 'Fudged group workout',
      issued_by: ctx.me.id,
    }));
  }
  await must(d
    .from('group_workouts')
    .update({ status: decision === 'dismiss' ? 'verified' : 'rejected', reviewed_by: ctx.me.id, reviewed_at: now })
    .eq('id', gw.id));
  done();
}

async function addPenaltyImpl(form: FormData) {
  const ctx = await requireAdmin();
  const teamId = str(form, 'team_id');
  const reason = str(form, 'reason').slice(0, 300);
  if (!ctx.teams.some((t) => t.id === teamId)) throw new Error('Choose a team.');
  if (!reason) throw new Error('Add a reason for the penalty.');
  await must(db().from('penalties').insert({ team_id: teamId, points: -Math.abs(ctx.challenge.fudge_penalty), reason, issued_by: ctx.me.id }));
  done();
}

async function deletePenaltyImpl(form: FormData) {
  const ctx = await requireAdmin();
  const id = str(form, 'id');
  const { data } = await db().from('penalties').select('team_id').eq('id', id).maybeSingle();
  if (!data || !ctx.teams.some((t) => t.id === data.team_id)) return;
  await must(db().from('penalties').delete().eq('id', id));
  done();
}

export const toggleActivity = safe(toggleActivityImpl);
export const addActivity = safe(addActivityImpl);
export const saveRules = safe(saveRulesImpl);
export const resolveFlag = safe(resolveFlagImpl);
export const resolveGroupFlag = safe(resolveGroupFlagImpl);
export const addPenalty = safe(addPenaltyImpl);
export const deletePenalty = safe(deletePenaltyImpl);
