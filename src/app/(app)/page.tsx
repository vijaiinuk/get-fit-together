import Link from 'next/link';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getStandings } from '@/lib/data';
import { addDays, daysBetween, formatDay, formatLongDay, minutesUntilMidnight } from '@/lib/dates';
import { entryStatusLabel, formatQuantity, plural } from '@/lib/format';
import type { ActivityType, EntryScore } from '@/lib/types';
import { EntryForm } from './EntryForm';

export default async function HomePage() {
  const ctx = await getContext();
  const d = db();
  const { challenge, me, today } = ctx;

  const [typesRes, myEntriesRes, standings, broadcastRes, groupRes] = await Promise.all([
    d.from('activity_types').select('*').eq('challenge_id', challenge.id).eq('enabled', true).order('sort'),
    d.from('entry_scores').select('*').eq('participant_id', me.id).order('entry_date', { ascending: false }),
    getStandings(challenge.id),
    ctx.myTeam
      ? d
          .from('posts')
          .select('body, created_at, author_id')
          .eq('kind', 'broadcast')
          .eq('team_id', ctx.myTeam.id)
          .eq('hidden', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    d.from('group_workout_participants').select('group_workout_id').eq('participant_id', me.id),
  ]);

  const types = (typesRes.data ?? []) as ActivityType[];
  const entries = (myEntriesRes.data ?? []) as EntryScore[];
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const todayEntry = byDate.get(today);

  const started = today >= challenge.starts_on;
  const ended = today > challenge.ends_on;
  const lastDay = ended ? challenge.ends_on : today;
  const daysSoFar = started ? daysBetween(challenge.starts_on, lastDay) + 1 : 0;
  const points = entries.reduce((sum, e) => sum + e.points, 0);

  const counts = (e?: EntryScore) => !!e && e.quantity >= e.threshold && (e.status === 'verified' || e.status === 'pending');
  let streak = 0;
  let cursor = counts(todayEntry) ? today : addDays(today, -1);
  while (cursor >= challenge.starts_on && counts(byDate.get(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => {
    const e = byDate.get(date);
    if (date < challenge.starts_on || date > challenge.ends_on) return { date, mark: '–', label: 'Off', cls: 'bg-line text-muted' };
    if (!e) return date === today
      ? { date, mark: '?', label: 'Today', cls: 'bg-white border border-edge text-info' }
      : { date, mark: '0', label: 'Missed', cls: 'bg-line text-[#3F4652]' };
    if (e.points === 1) return { date, mark: '1', label: 'Verified', cls: 'bg-okbg text-ok' };
    if (e.status === 'pending' && e.quantity >= e.threshold) return { date, mark: '…', label: 'Pending', cls: 'bg-infobg text-info' };
    return { date, mark: '0', label: e.quantity < e.threshold ? 'Too short' : 'Not counted', cls: 'bg-warnbg text-warn' };
  });

  let broadcastAuthor = '';
  if (broadcastRes.data) {
    const { data: a } = await d.from('participants').select('display_name').eq('id', broadcastRes.data.author_id).maybeSingle();
    broadcastAuthor = a?.display_name ?? 'Your captain';
  }

  // Role cards
  let captainCard: { logged: number; size: number; submitted: boolean } | null = null;
  if (ctx.captainOf) {
    const [{ count: logged }, { count: size }, { data: sc }] = await Promise.all([
      d.from('entries').select('id', { count: 'exact', head: true }).eq('team_id', ctx.captainOf.id).eq('entry_date', today),
      d.from('participants').select('id', { count: 'exact', head: true }).eq('team_id', ctx.captainOf.id),
      d.from('scorecards').select('status').eq('team_id', ctx.captainOf.id).eq('score_date', today).maybeSingle(),
    ]);
    captainCard = { logged: logged ?? 0, size: size ?? 0, submitted: !!sc };
  }
  let toModerate = 0;
  if (ctx.moderates.length) {
    const { count } = await d
      .from('scorecards')
      .select('team_id', { count: 'exact', head: true })
      .in('team_id', ctx.moderates.map((t) => t.id))
      .eq('status', 'submitted');
    toModerate = count ?? 0;
  }
  let flagged = 0;
  if (ctx.isAdmin) {
    const [{ count }, { count: gwCount }] = await Promise.all([
      d.from('entries').select('id', { count: 'exact', head: true }).eq('challenge_id', challenge.id).eq('status', 'flagged'),
      d.from('group_workouts').select('id', { count: 'exact', head: true }).in('team_id', ctx.teams.map((t) => t.id)).eq('status', 'flagged'),
    ]);
    flagged = (count ?? 0) + (gwCount ?? 0);
  }

  const left = minutesUntilMidnight(challenge.timezone);
  const maxAvg = Math.max(daysSoFar, ...standings.map((s) => s.average), 1);

  return (
    <main className="page">
      <section>
        <div className="kicker">
          {challenge.name}, {formatLongDay(today)}
        </div>
        <h1 className="h1 mt-1.5">Hi {me.display_name.split(' ')[0]}</h1>
      </section>

      <section className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <div className={`card flex flex-col gap-4 border-t-[6px] ${todayEntry ? 'border-[#15803D]' : 'border-accent'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="h2 text-2xl">Today’s workout</h2>
              {started && !ended && (
                <span className="text-sm font-semibold text-warn">
                  Proof due by midnight, {Math.floor(left / 60)} h {left % 60} min left
                </span>
              )}
            </div>

            {!started && <p className="text-muted">The challenge starts on {formatLongDay(challenge.starts_on)}.</p>}
            {ended && <p className="text-muted">The challenge has ended. Check the final standings on the Teams page.</p>}
            {started && !ended && !ctx.myTeam && (
              <p className="text-muted">You’re not on a team yet. Your admin will add you to one.</p>
            )}

            {started && !ended && ctx.myTeam && !todayEntry && <EntryForm types={types} />}

            {started && !ended && todayEntry && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-okbg p-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#14532D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  <div className="flex-[1_1_240px]">
                    <div className="font-bold text-ok">
                      Uploaded: {todayEntry.activity_name}, {formatQuantity(todayEntry.unit, todayEntry.quantity)}
                    </div>
                    <div className="text-sm text-ok">
                      {todayEntry.status === 'pending'
                        ? 'Your captain adds it to tonight’s scorecard, then the moderator verifies it.'
                        : entryStatusLabel(todayEntry).label}
                    </div>
                  </div>
                </div>
                {todayEntry.status === 'pending' && (
                  <details className="group">
                    <summary className="btn-outline btn-sm w-fit cursor-pointer list-none">Change today’s entry</summary>
                    <div className="mt-4">
                      <EntryForm
                        types={types}
                        defaults={{ activityTypeId: todayEntry.activity_type_id, quantity: todayEntry.quantity }}
                      />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="h2">My challenge</h2>
              <span className="text-[13px] text-muted">Up to 1 point per day</span>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
              <div>
                <div className="text-[13px] text-muted">Points</div>
                <div className="font-display text-[32px] font-bold">
                  {points} <span className="text-base font-medium text-muted">/ {plural(daysSoFar, 'day')}</span>
                </div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Current streak</div>
                <div className="font-display text-[32px] font-bold">{plural(streak, 'day')}</div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Group workouts</div>
                <div className="font-display text-[32px] font-bold">{groupRes.data?.length ?? 0}</div>
              </div>
            </div>
            <h3 className="mb-2.5 mt-5 font-sans text-sm font-semibold">Last 7 days</h3>
            <ol className="grid grid-cols-7 gap-2">
              {week.map((w) => (
                <li key={w.date} className="flex flex-col items-center gap-1.5">
                  <span className={`flex h-11 w-full max-w-16 items-center justify-center rounded-lg font-bold ${w.cls}`} aria-hidden="true">
                    {w.mark}
                  </span>
                  <span className="text-center text-xs text-muted">
                    {formatDay(w.date).split(' ')[0]}
                    <br />
                    {w.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          {captainCard && (
            <div className="flex flex-col gap-3 rounded-[14px] bg-ink p-6 text-white">
              <div className="text-[13px] font-semibold text-[#FFC078]">As {ctx.captainOf!.name} captain</div>
              <div className="font-display text-xl font-bold">
                Today’s scorecard: {captainCard.logged} of {captainCard.size} logged
              </div>
              <div className="text-sm text-[#C9CED6]">
                {captainCard.submitted ? 'Submitted. You can resubmit until midnight.' : 'Submit it before midnight.'}
              </div>
              <Link href="/scorecard" className="btn-primary">
                Open scorecard
              </Link>
            </div>
          )}
          {ctx.moderates.length > 0 && (
            <div className="flex flex-col gap-3 rounded-[14px] border border-[#FFD8A8] bg-[#FFF4E6] p-6">
              <div className="text-[13px] font-semibold text-warn">
                As moderator of {ctx.moderates.map((t) => t.name).join(', ')}
              </div>
              <div className="font-display text-xl font-bold">
                {toModerate ? `${plural(toModerate, 'scorecard')} to verify` : 'Nothing to verify right now'}
              </div>
              <Link href="/moderate" className="btn-dark">
                Open moderation
              </Link>
            </div>
          )}
          {ctx.isAdmin && flagged > 0 && (
            <div className="card flex flex-col gap-3">
              <div className="text-[13px] font-semibold text-muted">As admin</div>
              <div className="font-display text-xl font-bold">{plural(flagged, 'item')} flagged by moderators</div>
              <Link href="/admin" className="btn-dark">
                Review flags
              </Link>
            </div>
          )}

          {broadcastRes.data && (
            <div className="flex flex-col gap-2 rounded-[14px] bg-ink p-5 text-white">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#FFC078]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6" />
                </svg>
                From your captain, {broadcastAuthor}
              </div>
              <p className="whitespace-pre-line leading-relaxed">{broadcastRes.data.body}</p>
              <Link href="/community" className="text-sm font-semibold text-[#FFC078] hover:underline">
                Open community
              </Link>
            </div>
          )}

          <div className="card">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="h2 text-xl">Standings</h2>
              <Link href="/teams" className="link text-sm">
                See all teams
              </Link>
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {standings.map((s) => (
                <li key={s.team_id} className="grid grid-cols-[24px_80px_minmax(0,1fr)_44px] items-center gap-2.5">
                  <span className="font-bold text-muted">{s.rank}</span>
                  <span className={s.team_id === ctx.myTeam?.id ? 'font-bold' : ''}>{s.name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full" style={{ width: `${Math.min(100, (s.average / maxAvg) * 100)}%`, background: s.color }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{s.average.toFixed(1)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3.5 text-[13px] text-muted">Average points per member. Final standings at month end.</p>
          </div>

        </div>
      </section>
    </main>
  );
}
