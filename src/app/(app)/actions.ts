'use server';

import { must } from '@/lib/safe';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext } from '@/lib/context';
import { assertUploadedProof, int, str } from '@/lib/guards';
import type { ActivityType, Participant } from '@/lib/types';

export type EntryFormState = { ok?: boolean; error?: string };

// A member logs their own workout for today, or a captain logs one for a teammate.
// Entries can only be made for today (in the challenge timezone), so the midnight rule is automatic.
export async function submitEntry(_prev: EntryFormState, form: FormData): Promise<EntryFormState> {
  try {
    const ctx = await getContext();
    const d = db();
    const targetId = str(form, 'participant_id') || ctx.me.id;

    let target: Participant = ctx.me;
    if (targetId !== ctx.me.id) {
      const { data } = await d.from('participants').select('*').eq('id', targetId).maybeSingle<Participant>();
      if (!data || data.challenge_id !== ctx.challenge.id) return { error: 'That member wasn’t found.' };
      const isTheirCaptain = ctx.captainOf && ctx.captainOf.id === data.team_id;
      if (!isTheirCaptain && !ctx.isAdmin) return { error: 'Only their captain can log for someone else.' };
      target = data;
    }
    if (!target.team_id) return { error: 'You need to be on a team before logging workouts.' };

    const { data: type } = await d
      .from('activity_types')
      .select('*')
      .eq('id', str(form, 'activity_type_id'))
      .maybeSingle<ActivityType>();
    if (!type || type.challenge_id !== ctx.challenge.id || !type.enabled) return { error: 'Choose an activity.' };

    const quantity = int(form, 'quantity');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: type.unit === 'steps' ? 'Enter your step count.' : 'Enter how many minutes.' };
    }
    if (quantity > (type.unit === 'steps' ? 100000 : 600)) return { error: 'That number looks too high. Check it and try again.' };

    const proofPath = await assertUploadedProof(ctx, form.get('proof_path'));

    const { data: existing } = await d
      .from('entries')
      .select('id, status')
      .eq('participant_id', target.id)
      .eq('entry_date', ctx.today)
      .maybeSingle();
    if (existing && existing.status !== 'pending') {
      return { error: 'Today’s entry has already been reviewed, so it can’t be changed.' };
    }

    const { error } = await d.from('entries').upsert(
      {
        challenge_id: ctx.challenge.id,
        participant_id: target.id,
        team_id: target.team_id,
        entry_date: ctx.today,
        activity_type_id: type.id,
        quantity,
        proof_path: proofPath,
        submitted_at: new Date().toISOString(),
        submitted_by: ctx.me.id,
        status: 'pending',
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
      },
      { onConflict: 'participant_id,entry_date' },
    );
    if (error) return { error: 'Could not save the entry. Try again.' };

    // A new entry after verification reopens the day for the moderator.
    await must(d
      .from('scorecards')
      .update({ status: 'submitted', verified_by: null, verified_at: null })
      .eq('team_id', target.team_id)
      .eq('score_date', ctx.today));

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the entry.' };
  }
}
