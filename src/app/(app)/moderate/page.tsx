import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getParticipants, signedProofUrls } from '@/lib/data';
import { formatDay, formatLongDay, formatTime, isIsoDate } from '@/lib/dates';
import { entryStatusLabel, formatQuantity, plural } from '@/lib/format';
import type { EntryScore, GroupWorkoutScore, Scorecard } from '@/lib/types';
import { Pill } from '@/components/Pill';
import { ProofImage } from '@/components/ProofImage';
import { SubmitButton } from '@/components/SubmitButton';
import { completeScorecard, reviewEntry, reviewGroupWorkout } from './actions';
import { ActionForm } from '@/components/ActionForm';

export default async function ModeratePage({ searchParams }: { searchParams: Promise<{ team?: string; date?: string }> }) {
  const ctx = await getContext();
  const sp = await searchParams;
  const choices = ctx.isAdmin && ctx.moderates.length === 0 ? ctx.teams : ctx.moderates;
  if (choices.length === 0) redirect('/');
  const team = choices.find((t) => t.id === sp.team) ?? choices[0];
  const d = db();

  const { data: scRows } = await d
    .from('scorecards')
    .select('*')
    .eq('team_id', team.id)
    .order('score_date', { ascending: false })
    .limit(14);
  const scorecards = (scRows ?? []) as Scorecard[];
  const firstOpen = scorecards.filter((s) => s.status === 'submitted').at(-1);
  const date = isIsoDate(sp.date) ? sp.date : firstOpen?.score_date ?? scorecards[0]?.score_date ?? ctx.today;
  const scorecard = scorecards.find((s) => s.score_date === date) ?? null;

  const [participants, entriesRes, gwRes] = await Promise.all([
    getParticipants(ctx.challenge.id),
    d.from('entry_scores').select('*').eq('team_id', team.id).eq('entry_date', date).order('submitted_at'),
    d.from('group_workout_scores').select('*').eq('team_id', team.id).eq('workout_date', date).maybeSingle(),
  ]);
  const entries = (entriesRes.data ?? []) as EntryScore[];
  const gw = gwRes.data as GroupWorkoutScore | null;
  // Moderators check that proofs match the person, so show "Alias (Name)" when someone uses an alias.
  const nameOf = new Map(
    participants.map((p) => [
      p.id,
      p.alias && p.full_name && p.alias !== p.full_name ? `${p.alias} (${p.full_name})` : p.display_name,
    ]),
  );
  const urls = await signedProofUrls([...entries.map((e) => e.proof_path), gw?.proof_path ?? '']);
  let gwNames: string[] = [];
  if (gw) {
    const { data } = await d.from('group_workout_participants').select('participant_id').eq('group_workout_id', gw.id);
    gwNames = (data ?? []).map((r) => nameOf.get(r.participant_id) ?? 'Member');
  }

  const locked = scorecard?.status === 'verified' && !ctx.isAdmin;
  const pending = entries.filter((e) => e.status === 'pending').length + (gw?.status === 'pending' ? 1 : 0);
  const verifiedPoints = entries.reduce((s, e) => s + e.points, 0);
  const captain = team.captain_id ? nameOf.get(team.captain_id) : 'the captain';
  const moderator = team.moderator_id && team.moderator_id !== ctx.me.id ? nameOf.get(team.moderator_id) : null;
  const qs = (extra: string) => `/moderate?team=${team.id}&${extra}`;

  return (
    <main className="page">
      <section>
        <div className="kicker">
          You moderate {team.name}, {formatLongDay(date)}
        </div>
        <h1 className="h1 mt-1.5">Verify scorecard</h1>
        <p className="mt-2 max-w-[680px] text-muted">
          {scorecard
            ? `Submitted by ${scorecard.submitted_by ? nameOf.get(scorecard.submitted_by) : captain} at ${formatTime(scorecard.submitted_at, ctx.challenge.timezone)}. `
            : `${captain} hasn’t submitted this day yet. `}
          Check each proof matches the entry and the date. If something looks fudged, flag it for an admin to decide on a penalty.
        </p>
      </section>

      {choices.length > 1 && (
        <nav aria-label="Choose a team" className="flex flex-wrap gap-2">
          {choices.map((t) => (
            <Link key={t.id} href={`/moderate?team=${t.id}`} aria-current={t.id === team.id ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${t.id === team.id ? 'border-ink bg-ink text-white' : 'border-edge bg-white'}`}>
              {t.name}
            </Link>
          ))}
        </nav>
      )}

      {scorecards.length > 0 && (
        <nav aria-label="Choose a day" className="flex flex-wrap gap-2">
          {scorecards.map((s) => (
            <Link
              key={s.score_date}
              href={qs(`date=${s.score_date}`)}
              aria-current={s.score_date === date ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${s.score_date === date ? 'border-ink bg-ink text-white' : 'border-edge bg-white'}`}
            >
              {s.score_date === ctx.today ? 'Today' : formatDay(s.score_date)}
              <span className={s.status === 'verified' ? 'text-[#86EFAC]' : 'text-[#FDBA74]'}>{s.status === 'verified' ? 'done' : 'to check'}</span>
            </Link>
          ))}
        </nav>
      )}

      {entries.length === 0 && !gw ? (
        <div className="card text-muted">No entries for this day yet.</div>
      ) : (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {entries.map((e) => {
            const s = entryStatusLabel(e);
            const own = e.participant_id === ctx.me.id;
            return (
              <article key={e.id} className="card flex flex-col gap-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="h2 text-xl">{nameOf.get(e.participant_id)}</h2>
                  <span className="text-[13px] text-muted">Uploaded {formatTime(e.submitted_at, ctx.challenge.timezone)}</span>
                </div>
                <ProofImage url={urls.get(e.proof_path)} alt={`Proof from ${nameOf.get(e.participant_id)}`} />
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {e.activity_name}, {formatQuantity(e.unit, e.quantity)}
                  </span>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </div>
                {e.review_note && <p className="rounded-lg bg-ground px-3 py-2 text-sm">Note: {e.review_note}</p>}
                {!locked && !own && (
                  <ActionForm action={reviewEntry} className="flex flex-col gap-2">
                    <input type="hidden" name="entry_id" value={e.id} />
                    {/* Pressing Enter in the note box would otherwise submit with the first button (Verify).
                        A disabled first submit button makes Enter do nothing. */}
                    <button type="submit" disabled hidden aria-hidden="true" tabIndex={-1} />
                    <label htmlFor={`note-${e.id}`} className="sr-only">
                      Note for admin
                    </label>
                    <input id={`note-${e.id}`} name="note" maxLength={500} placeholder="Note (needed when flagging)" className="input" />
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton name="decision" value="verified" className="btn-dark flex-1" pendingText="…">
                        Verify
                      </SubmitButton>
                      <SubmitButton name="decision" value="rejected" className="btn-outline flex-1" pendingText="…">
                        Reject
                      </SubmitButton>
                      <SubmitButton name="decision" value="flagged" className="btn flex-1 border border-warn bg-white text-warn hover:bg-warnbg" pendingText="…">
                        Flag to admin
                      </SubmitButton>
                    </div>
                  </ActionForm>
                )}
                {own && (
                  <p className="rounded-lg bg-ground px-3 py-2 text-[13px] text-muted">
                    You can’t review your own entry. {moderator ? `${moderator} reviews it as ${team.name}’s moderator.` : `${team.name} has no moderator yet, so set one in Admin.`}
                  </p>
                )}
                {locked && !own && (
                  <p className="rounded-lg bg-ground px-3 py-2 text-[13px] text-muted">
                    This scorecard is complete, so entries are locked. If something looks wrong, message an admin.
                  </p>
                )}
              </article>
            );
          })}

          {gw && (
            <article className="card flex flex-col gap-3.5 border-t-[6px] border-info">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="h2 text-xl">Group workout</h2>
                <Pill tone={gw.status === 'verified' ? 'ok' : gw.status === 'rejected' ? 'bad' : gw.status === 'flagged' ? 'warn' : 'info'}>
                  {gw.status === 'verified' ? 'Verified' : gw.status === 'rejected' ? 'Rejected' : gw.status === 'flagged' ? 'Flagged to admin' : 'Awaiting verification'}
                </Pill>
              </div>
              <ProofImage url={urls.get(gw.proof_path)} alt="Group workout photo" />
              <p>
                <span className="font-semibold">{gw.description}</span>
                <br />
                <span className="text-sm text-muted">
                  {plural(gw.participant_count, 'person', 'people')}: {gwNames.join(', ')}
                </span>
              </p>
              {gw.review_note && <p className="rounded-lg bg-ground px-3 py-2 text-sm">Note: {gw.review_note}</p>}
              {!locked && (
                <ActionForm action={reviewGroupWorkout} className="flex flex-col gap-2">
                  <input type="hidden" name="group_workout_id" value={gw.id} />
                  {/* Pressing Enter in the note box would otherwise submit with the first button (Verify).
                      A disabled first submit button makes Enter do nothing. */}
                    <button type="submit" disabled hidden aria-hidden="true" tabIndex={-1} />
                  <label htmlFor={`note-gw-${gw.id}`} className="sr-only">
                    Note for admin
                  </label>
                  <input id={`note-gw-${gw.id}`} name="note" maxLength={500} placeholder="Note (needed when flagging)" className="input" />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton name="decision" value="verified" className="btn-dark flex-1" pendingText="…">
                      Verify
                    </SubmitButton>
                    <SubmitButton name="decision" value="rejected" className="btn-outline flex-1" pendingText="…">
                      Reject
                    </SubmitButton>
                    <SubmitButton name="decision" value="flagged" className="btn flex-1 border border-warn bg-white text-warn hover:bg-warnbg" pendingText="…">
                      Flag to admin
                    </SubmitButton>
                  </div>
                </ActionForm>
              )}
              {locked && (
                <p className="rounded-lg bg-ground px-3 py-2 text-[13px] text-muted">
                  This scorecard is complete, so the group workout is locked. If something looks wrong, message an admin.
                </p>
              )}
            </article>
          )}
        </section>
      )}

      {scorecard && (
        <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[14px] bg-ink p-6 text-white">
          <div className="flex-[1_1_260px]">
            <div className="font-display text-xl font-bold">
              {entries.length - entries.filter((e) => e.status === 'pending').length} of {entries.length} reviewed,{' '}
              {plural(verifiedPoints, 'verified point')}
            </div>
            <div className="mt-1 text-[13px] text-[#C9CED6]">
              {scorecard.status === 'verified'
                ? 'This scorecard is complete.'
                : pending
                  ? 'Review every entry, then complete the scorecard.'
                  : 'Everything is reviewed. Flagged entries go to the admins.'}
            </div>
          </div>
          {scorecard.status !== 'verified' && (
            <ActionForm action={completeScorecard}>
              <input type="hidden" name="team_id" value={team.id} />
              <input type="hidden" name="date" value={date} />
              <SubmitButton disabled={pending > 0} pendingText="Completing…">
                Complete review
              </SubmitButton>
            </ActionForm>
          )}
        </section>
      )}
    </main>
  );
}
