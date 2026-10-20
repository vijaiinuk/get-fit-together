import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getActivityTypes } from '@/lib/cached';
import { getParticipants, signedProofUrls } from '@/lib/data';
import { addDays, formatDay, formatLongDay, formatTime, isIsoDate, minutesUntilMidnight } from '@/lib/dates';
import { entryStatusLabel, formatQuantity } from '@/lib/format';
import type { ActivityType, EntryScore, GroupWorkoutScore, Scorecard } from '@/lib/types';
import { Pill } from '@/components/Pill';
import { ProofUploader } from '@/components/ProofUploader';
import { SubmitButton } from '@/components/SubmitButton';
import { EntryForm } from '../EntryForm';
import { createGroupWorkout, deleteGroupWorkout, submitScorecard, updateEntry } from './actions';
import { ActionForm } from '@/components/ActionForm';

export default async function ScorecardPage({ searchParams }: { searchParams: Promise<{ team?: string; date?: string }> }) {
  const ctx = await getContext();
  const sp = await searchParams;
  const team = (ctx.isAdmin && sp.team ? ctx.teams.find((t) => t.id === sp.team) : null) ?? ctx.captainOf;
  if (!team) redirect('/');

  const date = isIsoDate(sp.date) && sp.date <= ctx.today ? sp.date : ctx.today;
  const isToday = date === ctx.today;
  const d = db();
  const [participants, typesRes, entriesRes, gwRes, scRes] = await Promise.all([
    getParticipants(ctx.challenge.id),
    getActivityTypes(ctx.challenge.id).then((all) => ({ data: all.filter((t) => t.enabled) })),
    d.from('entry_scores').select('*').eq('team_id', team.id).eq('entry_date', date),
    d.from('group_workout_scores').select('*').eq('team_id', team.id).eq('workout_date', date).maybeSingle(),
    d.from('scorecards').select('*').eq('team_id', team.id).eq('score_date', date).maybeSingle(),
  ]);
  const types = (typesRes.data ?? []) as ActivityType[];
  const entries = (entriesRes.data ?? []) as EntryScore[];
  const gw = gwRes.data as GroupWorkoutScore | null;
  const scorecard = scRes.data as Scorecard | null;
  const members = participants.filter((p) => p.team_id === team.id);
  const byMember = new Map(entries.map((e) => [e.participant_id, e]));
  const nameOf = new Map(participants.map((p) => [p.id, p.display_name]));
  const moderator = team.moderator_id ? nameOf.get(team.moderator_id) : null;
  const urls = await signedProofUrls([...entries.map((e) => e.proof_path), gw?.proof_path ?? '']);

  let gwMembers: string[] = [];
  if (gw) {
    const { data } = await d.from('group_workout_participants').select('participant_id').eq('group_workout_id', gw.id);
    gwMembers = (data ?? []).map((r) => nameOf.get(r.participant_id) ?? 'Member');
  }

  const claimed = entries.filter((e) => e.quantity >= e.threshold && e.status !== 'rejected' && e.status !== 'flagged').length;
  const bonus = gw && gw.status !== 'rejected' && gw.status !== 'flagged' && gw.participant_count >= ctx.challenge.group_min_members ? ctx.challenge.group_team_bonus : 0;
  const left = minutesUntilMidnight(ctx.challenge.timezone);
  const pastDays = Array.from({ length: 7 }, (_, i) => addDays(ctx.today, -i)).filter((x) => x >= ctx.challenge.starts_on);
  const qs = (extra: string) => `?${ctx.isAdmin && sp.team ? `team=${team.id}&` : ''}${extra}`;

  return (
    <main className="page">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">
            {team.name}, {formatLongDay(date)}
          </div>
          <h1 className="h1 mt-1.5">Daily scorecard</h1>
          <p className="mt-2 text-muted">
            {moderator ? `Moderated by ${moderator}. ` : 'No moderator assigned yet. '}Proof must be in before midnight.
          </p>
        </div>
        {isToday && (
          <div className="rounded-xl border border-[#FFD8A8] bg-[#FFF4E6] px-4 py-3">
            <div className="font-bold text-warn">Due by midnight</div>
            <div className="text-[13px] text-muted">
              {Math.floor(left / 60)} h {left % 60} min left
            </div>
          </div>
        )}
      </section>

      <nav aria-label="Choose a day" className="flex flex-wrap gap-2">
        {pastDays.map((day) => (
          <Link
            key={day}
            href={`/scorecard${qs(`date=${day}`)}`}
            aria-current={day === date ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${day === date ? 'border-ink bg-ink text-white' : 'border-edge bg-white'}`}
          >
            {day === ctx.today ? 'Today' : formatDay(day)}
          </Link>
        ))}
      </nav>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">Member entries</h2>
          <span className="text-[13px] text-muted">
            {entries.length} of {members.length} logged. 40 min of activity or 8,000 steps earns 1 point.
          </span>
        </div>
        <ul className="mt-4">
          {members.map((m) => {
            const e = byMember.get(m.id);
            const status = e ? entryStatusLabel(e) : null;
            return (
              <li key={m.id} className="flex flex-col gap-3 border-t border-line py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-[160px] flex-1 font-semibold">{m.display_name}</span>
                  {e ? (
                    <>
                      <span>
                        {e.activity_name}, {formatQuantity(e.unit, e.quantity)}
                      </span>
                      {urls.get(e.proof_path) && (
                        <a href={urls.get(e.proof_path)} target="_blank" rel="noreferrer" className="link text-sm">
                          View proof
                        </a>
                      )}
                      <span className="text-[13px] text-muted">{formatTime(e.submitted_at, ctx.challenge.timezone)}</span>
                      <Pill tone={status!.tone}>{status!.label}</Pill>
                      <span className="w-6 text-right font-display text-xl font-bold">{e.quantity >= e.threshold && e.status !== 'rejected' && e.status !== 'flagged' ? 1 : 0}</span>
                    </>
                  ) : (
                    <Pill tone="muted">Not logged</Pill>
                  )}
                </div>
                {isToday && e && e.status === 'pending' && (
                  <details>
                    <summary className="btn-outline btn-sm w-fit cursor-pointer list-none">Correct entry</summary>
                    <ActionForm action={updateEntry} className="mt-3 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="entry_id" value={e.id} />
                      <div className="flex flex-col gap-1.5">
                        <label className="label" htmlFor={`fix-type-${e.id}`}>
                          Activity
                        </label>
                        <select id={`fix-type-${e.id}`} name="activity_type_id" defaultValue={e.activity_type_id} className="input">
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="label" htmlFor={`fix-qty-${e.id}`}>
                          Amount
                        </label>
                        <input id={`fix-qty-${e.id}`} name="quantity" type="number" min={1} defaultValue={e.quantity} className="input w-32" />
                      </div>
                      <SubmitButton className="btn-dark">Save</SubmitButton>
                    </ActionForm>
                  </details>
                )}
                {isToday && !e && (
                  <details>
                    <summary className="btn-outline btn-sm w-fit cursor-pointer list-none">Log for {m.display_name.split(' ')[0]}</summary>
                    <div className="mt-3 max-w-xl">
                      <EntryForm types={types} participantId={m.id} compact />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap items-start gap-6">
        <div className="card flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="h2">Group workout</h2>
            <span className="text-[13px] text-muted">
              {ctx.challenge.group_min_members}+ teammates together earns {ctx.challenge.group_team_bonus} team point
            </span>
          </div>
          {gw ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{gw.description}</span>
                <Pill tone={gw.status === 'verified' ? 'ok' : gw.status === 'rejected' ? 'bad' : gw.status === 'flagged' ? 'warn' : 'info'}>
                  {gw.status === 'verified' ? 'Verified' : gw.status === 'rejected' ? 'Rejected' : gw.status === 'flagged' ? 'Flagged to admin' : 'Awaiting verification'}
                </Pill>
                {urls.get(gw.proof_path) && (
                  <a href={urls.get(gw.proof_path)} target="_blank" rel="noreferrer" className="link text-sm">
                    View photo
                  </a>
                )}
              </div>
              <p className="text-sm text-muted">With {gwMembers.join(', ')}</p>
              {isToday && gw.status === 'pending' && (
                <ActionForm action={deleteGroupWorkout}>
                  <input type="hidden" name="group_workout_id" value={gw.id} />
                  <SubmitButton className="btn-outline btn-sm" pendingText="Removing…">
                    Remove group workout
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          ) : isToday ? (
            <ActionForm action={createGroupWorkout} className="flex flex-col gap-4">
              <input type="hidden" name="team_id" value={team.id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="gw-desc" className="label">
                  What did you do?
                </label>
                <input id="gw-desc" name="description" required maxLength={200} placeholder="e.g. Evening walk in the park" className="input" />
              </div>
              <fieldset>
                <legend className="label mb-2">Who took part?</legend>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-edge bg-white px-4 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                      <input type="checkbox" name="participant_ids" value={m.id} className="sr-only" />
                      {m.display_name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <ProofUploader label="Add group photo" hint="One photo showing everyone who took part" />
              <div>
                <SubmitButton className="btn-dark">Add group workout</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-muted">No group workout that day.</p>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] bg-ink p-6 text-white">
          <h2 className="font-display text-xl font-bold">{isToday ? 'Today’s total' : 'Day total'}</h2>
          <div className="flex justify-between">
            <span className="text-[#C9CED6]">Individual points</span>
            <span className="font-bold">{claimed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#C9CED6]">Team bonus</span>
            <span className="font-bold">{bonus}</span>
          </div>
          <div className="flex justify-between border-t border-[#3A414D] pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-[28px] font-bold">{claimed + bonus}</span>
          </div>
          <p className="text-[13px] text-[#C9CED6]">Points count once the moderator verifies them.</p>
          {isToday ? (
            <ActionForm action={submitScorecard} className="flex flex-col gap-2">
              <input type="hidden" name="team_id" value={team.id} />
              <SubmitButton pendingText="Submitting…">{scorecard ? 'Resubmit scorecard' : 'Submit scorecard'}</SubmitButton>
              <p className="text-[13px] text-[#C9CED6]">
                {scorecard
                  ? `Submitted at ${formatTime(scorecard.submitted_at, ctx.challenge.timezone)}${moderator ? ` and sent to ${moderator}` : ''}. You can resubmit until midnight.`
                  : 'Entries without proof can’t be added. You can resubmit until midnight.'}
              </p>
            </ActionForm>
          ) : (
            <p className="text-sm">
              {scorecard ? (scorecard.status === 'verified' ? 'Verified by the moderator.' : 'Submitted, awaiting verification.') : 'Not submitted.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
