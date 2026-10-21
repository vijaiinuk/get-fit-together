import Link from 'next/link';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getStandings } from '@/lib/data';
import { getActivityTypes } from '@/lib/cached';
import { addDays, daysBetween, formatDay, formatLongDay, formatTime, localDate, minutesUntilMidnight } from '@/lib/dates';
import { entryStatusLabel, formatQuantity, plural, score } from '@/lib/format';
import type { EntryScore } from '@/lib/types';
import { EntryForm } from './EntryForm';
import { TeamCard } from '@/components/TeamCard';
import { Avatar, tint } from '@/components/Avatar';

export default async function HomePage() {
  const ctx = await getContext();
  const d = db();
  const { challenge, me, today } = ctx;

  const nothing = Promise.resolve({ count: 0 as number | null });
  const myTeamId = ctx.myTeam?.id;
  const captainTeamId = ctx.captainOf?.id;
  const teamIds = ctx.teams.map((t) => t.id);

  // Everything the page needs, fetched in one parallel batch. Names, teams and activity types come
  // from the request context and cache, so they cost no extra queries.
  const [
    allTypes,
    myEntriesRes,
    standings,
    broadcastRes,
    groupRes,
    teamLoggedRes,
    captainScorecardRes,
    toModerateRes,
    flaggedEntriesRes,
    flaggedGroupsRes,
    todayEntriesRes,
    todayGroupsRes,
    recentPostsRes,
  ] = await Promise.all([
    getActivityTypes(challenge.id),
    d.from('entry_scores').select('*').eq('participant_id', me.id).order('entry_date', { ascending: false }),
    getStandings(challenge.id),
    myTeamId
      ? d
          .from('posts')
          .select('id, body, created_at, author_id, comments(count), reactions(count)')
          .eq('kind', 'broadcast')
          .eq('team_id', myTeamId)
          .eq('hidden', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    d.from('group_workout_participants').select('group_workout_id').eq('participant_id', me.id),
    myTeamId ? d.from('entries').select('id', { count: 'exact', head: true }).eq('team_id', myTeamId).eq('entry_date', today) : nothing,
    captainTeamId
      ? d.from('scorecards').select('status').eq('team_id', captainTeamId).eq('score_date', today).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.moderates.length
      ? d.from('scorecards').select('team_id', { count: 'exact', head: true }).in('team_id', ctx.moderates.map((t) => t.id)).eq('status', 'submitted')
      : nothing,
    ctx.isAdmin
      ? d.from('entries').select('id', { count: 'exact', head: true }).eq('challenge_id', challenge.id).eq('status', 'flagged')
      : nothing,
    ctx.isAdmin ? d.from('group_workouts').select('id', { count: 'exact', head: true }).in('team_id', teamIds).eq('status', 'flagged') : nothing,
    // Today's activity for every team, for the standings.
    d.from('entry_scores').select('team_id, points, status, quantity, threshold').eq('challenge_id', challenge.id).eq('entry_date', today),
    d.from('group_workout_scores').select('team_id, team_points, status, participant_count').in('team_id', teamIds).eq('workout_date', today),
    // Latest community posts with like and reply counts; filtered to today below.
    d
      .from('posts')
      .select('id, author_id, body, created_at, comments(count), reactions(count)')
      .eq('challenge_id', challenge.id)
      .eq('kind', 'post')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const types = allTypes.filter((t) => t.enabled);
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

  const personById = new Map(ctx.people.map((p) => [p.id, p]));
  const broadcastAuthor = broadcastRes.data ? personById.get(broadcastRes.data.author_id)?.display_name ?? 'Your captain' : '';

  // Role cards
  const loggedToday = teamLoggedRes.count ?? 0;
  const captainCard = ctx.captainOf
    ? {
        logged: loggedToday, // the captain's team is their own team
        size: ctx.people.filter((p) => p.team_id === ctx.captainOf!.id).length,
        submitted: !!captainScorecardRes.data,
      }
    : null;
  const toModerate = toModerateRes.count ?? 0;
  const flagged = (flaggedEntriesRes.count ?? 0) + (flaggedGroupsRes.count ?? 0);

  // Your team: captain, moderator, standing and today's progress.
  let teamCard: React.ReactNode = null;
  if (ctx.myTeam) {
    const t = ctx.myTeam;
    const person = (id: string | null, withTeam: boolean) => {
      const p = id ? personById.get(id) : undefined;
      if (!p) return null;
      return {
        name: p.display_name,
        isMe: p.id === me.id,
        avatarUrl: p.avatar_url,
        teamName: withTeam ? ctx.teams.find((x) => x.id === p.team_id)?.name ?? null : null,
      };
    };
    const standing = standings.find((x) => x.team_id === t.id);
    teamCard = (
      <TeamCard
        team={t}
        rank={standing?.rank ?? null}
        teamCount={standings.length}
        total={standing?.total ?? 0}
        members={standing?.member_count ?? 0}
        loggedToday={loggedToday}
        captain={person(t.captain_id, false)}
        moderator={person(t.moderator_id, true)}
        showToday={started && !ended}
      />
    );
  }

  const left = minutesUntilMidnight(challenge.timezone);

  // Today per team: points already verified, plus entries still waiting for the moderator.
  const todayByTeam = new Map<string, { points: number; pending: number }>();
  const bump = (teamId: string, points: number, pending: number) => {
    const t = todayByTeam.get(teamId) ?? { points: 0, pending: 0 };
    todayByTeam.set(teamId, { points: t.points + points, pending: t.pending + pending });
  };
  for (const e of (todayEntriesRes.data ?? []) as { team_id: string; points: number; status: string; quantity: number; threshold: number }[]) {
    bump(e.team_id, e.points, e.status === 'pending' && e.quantity >= e.threshold ? 1 : 0);
  }
  for (const g of (todayGroupsRes.data ?? []) as { team_id: string; team_points: number; status: string; participant_count: number }[]) {
    bump(g.team_id, g.team_points, g.status === 'pending' && g.participant_count >= challenge.group_min_members ? challenge.group_team_bonus : 0);
  }
  const live = started && !ended;

  const broadcastBlock = broadcastRes.data && (
    <section aria-label="Team news" className="flex flex-col gap-2 rounded-[14px] bg-ink p-5 pl-6 text-white" style={{ boxShadow: `inset 6px 0 0 ${ctx.myTeam?.color ?? '#F08C4B'}` }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="flex items-center gap-2 font-bold text-[#FFC078]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6" />
          </svg>
          Team news from {broadcastAuthor}
        </span>
        <span className="text-[#C9CED6]">
          {broadcastRes.data.created_at.slice(0, 10) === today ? 'today' : formatDay(broadcastRes.data.created_at.slice(0, 10))}
        </span>
      </div>
      <p className="whitespace-pre-line text-base leading-relaxed">{broadcastRes.data.body}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link href={`/community#post-${broadcastRes.data.id}`} className="font-semibold text-[#FFC078] hover:underline">
          Like or reply
        </Link>
        {(() => {
          const likes = (broadcastRes.data.reactions as { count: number }[] | undefined)?.[0]?.count ?? 0;
          const replies = (broadcastRes.data.comments as { count: number }[] | undefined)?.[0]?.count ?? 0;
          return likes || replies ? (
            <span className="text-[#C9CED6]">
              {[likes ? plural(likes, 'like') : null, replies ? plural(replies, 'reply', 'replies') : null].filter(Boolean).join(' · ')}
            </span>
          ) : null;
        })()}
      </div>
    </section>
  );

  const standingsCard = (
    <section aria-labelledby="standings" className="card min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="standings" className="h2 text-xl">
          Standings
        </h2>
        <Link href="/teams" className="link text-sm">
          See all teams
        </Link>
      </div>
      <table className="mt-3 w-full table-fixed border-collapse text-[15px]">
        <colgroup>
          <col className="w-7" />
          <col />
          {live && <col className="w-[68px]" />}
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="table-head">
            <th className="py-2 pl-1 font-semibold">#</th>
            <th className="py-2 font-semibold">Team</th>
            {live && <th className="py-2 text-right font-semibold">Today</th>}
            <th className="py-2 pr-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((st) => {
            const t = todayByTeam.get(st.team_id) ?? { points: 0, pending: 0 };
            const mine = st.team_id === ctx.myTeam?.id;
            return (
              <tr key={st.team_id} className={`border-t border-line ${mine ? 'bg-ground' : ''}`}>
                <td className="py-2.5 pl-1 font-bold tabular-nums text-muted">{st.rank}</td>
                <td className="py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 flex-none rounded-full" style={{ background: st.color }} aria-hidden="true" />
                    <span className={`truncate ${mine ? 'font-bold' : ''}`}>{st.name}</span>
                  </span>
                </td>
                {live && (
                  <td className="py-2.5 text-right tabular-nums leading-tight">
                    <span className={t.points ? 'font-semibold text-ok' : 'text-muted'}>{score(t.points, true)}</span>
                    {t.pending > 0 && <span className="block whitespace-nowrap text-[11px] text-muted">{t.pending} pending</span>}
                  </td>
                )}
                <td className={`py-2.5 pr-1 text-right font-display text-lg font-bold tabular-nums ${st.total < 0 ? 'text-bad' : ''}`}>
                  {score(st.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-muted">
        Ranked by points per member, so bigger teams don’t get an advantage.{live ? ' Today’s points count once the moderator verifies them.' : ''}
      </p>
    </section>
  );

  const roleCards = (
    <>
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
    </>
  );

  // Today's community posts (first 5), shown at the bottom of the page.
  type RecentPost = { id: string; author_id: string; body: string; created_at: string; comments: { count: number }[]; reactions: { count: number }[] };
  const todaysPosts = ((recentPostsRes.data ?? []) as RecentPost[])
    .filter((p) => localDate(challenge.timezone, new Date(p.created_at)) === today)
    .slice(0, 5);
  const communityCard = (
    <section aria-labelledby="community-today" className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="community-today" className="h2 text-xl">
          Today in the community
        </h2>
        <Link href="/community" className="link text-sm">
          Open community
        </Link>
      </div>
      {todaysPosts.length === 0 ? (
        <p className="mt-3 text-muted">
          No posts yet today.{' '}
          <Link href="/community" className="link text-ink">
            Share how your workout went
          </Link>
        </p>
      ) : (
        <ul className="mt-2">
          {todaysPosts.map((p) => {
            const author = personById.get(p.author_id);
            const team = author?.team_id ? ctx.teams.find((t) => t.id === author.team_id) : undefined;
            const likes = p.reactions?.[0]?.count ?? 0;
            const replies = p.comments?.[0]?.count ?? 0;
            return (
              <li key={p.id} className="border-t border-line first:border-t-0">
                <Link href={`/community#post-${p.id}`} className="-mx-2 flex gap-3 rounded-lg px-2 py-3 hover:bg-ground">
                  <Avatar name={author?.display_name ?? '?'} src={author?.avatar_url} color={team ? tint(team.color) : undefined} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{author?.display_name ?? 'Former member'}</span>
                      <span className="text-xs text-muted">
                        {team?.name ? `${team.name} · ` : ''}
                        {formatTime(p.created_at, challenge.timezone)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[15px]">{p.body}</p>
                    {(likes > 0 || replies > 0) && (
                      <p className="mt-1 text-xs text-muted">
                        {[likes ? plural(likes, 'like') : null, replies ? plural(replies, 'reply', 'replies') : null].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  // Same blocks in both layouts: on phones they follow today's upload; on wide screens they form the right column.
  const sideBlocks = (
    <>
      {standingsCard}
      {roleCards}
      {teamCard}
    </>
  );
  return (
    <main className="page">
      <section>
        <div className="kicker">
          {challenge.name}, {formatLongDay(today)}
        </div>
        <h1 className="h1 mt-1.5">Hi {me.display_name.split(' ')[0]}</h1>
      </section>

      {broadcastBlock}

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

          {/* On phones: standings, role actions and your team come straight after today's upload. */}
          <div className="flex flex-col gap-6 lg:hidden">{sideBlocks}</div>

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

        <div className="hidden min-w-0 flex-[1_1_320px] flex-col gap-6 lg:flex">{sideBlocks}</div>
      </section>

      {communityCard}
    </main>
  );
}
