import Link from 'next/link';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getParticipants, getPointsByParticipant, getStandings, ordinal } from '@/lib/data';
import { daysBetween, formatDay } from '@/lib/dates';
import { entryStatusLabel, formatQuantity } from '@/lib/format';
import type { EntryScore, GroupWorkoutScore, Penalty } from '@/lib/types';
import { Avatar, tint } from '@/components/Avatar';
import { Pill, type Tone } from '@/components/Pill';

type Activity = { key: string; who: string; what: string; date: string; tag: string; tone: Tone; pts: string; ptsClass: string; at: string };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const ctx = await getContext();
  const { team: teamParam } = await searchParams;
  const d = db();
  const [standings, participants, points] = await Promise.all([
    getStandings(ctx.challenge.id),
    getParticipants(ctx.challenge.id),
    getPointsByParticipant(ctx.challenge.id),
  ]);

  if (standings.length === 0) {
    return (
      <main className="page">
        <h1 className="h1">Teams</h1>
        <p className="text-muted">No teams have been set up yet.</p>
      </main>
    );
  }

  const selected =
    standings.find((s) => s.team_id === teamParam) ?? standings.find((s) => s.team_id === ctx.myTeam?.id) ?? standings[0];
  const nameOf = new Map(participants.map((p) => [p.id, p.display_name]));
  const personOf = new Map(participants.map((p) => [p.id, p]));
  const members = participants
    .filter((p) => p.team_id === selected.team_id)
    .map((p) => ({ ...p, points: points.get(p.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name));

  const [entriesRes, groupsRes, penaltiesRes, todayRes] = await Promise.all([
    d.from('entry_scores').select('*').eq('team_id', selected.team_id).order('submitted_at', { ascending: false }).limit(15),
    d.from('group_workout_scores').select('*').eq('team_id', selected.team_id).order('workout_date', { ascending: false }).limit(5),
    d.from('penalties').select('*').eq('team_id', selected.team_id).order('created_at', { ascending: false }).limit(5),
    d.from('entries').select('participant_id').eq('team_id', selected.team_id).eq('entry_date', ctx.today),
  ]);
  const uploadedToday = new Set((todayRes.data ?? []).map((r) => r.participant_id));

  const activity: Activity[] = [
    ...((entriesRes.data ?? []) as EntryScore[]).map((e) => {
      const s = entryStatusLabel(e);
      const verifiedBy = e.status === 'verified' && e.reviewed_by ? `Verified by ${nameOf.get(e.reviewed_by) ?? 'moderator'}` : s.label;
      return {
        key: e.id,
        who: nameOf.get(e.participant_id) ?? 'Member',
        what: `${e.activity_name}, ${formatQuantity(e.unit, e.quantity)}`,
        date: e.entry_date,
        tag: verifiedBy,
        tone: s.tone,
        pts: e.points ? '+1' : e.status === 'pending' && e.quantity >= e.threshold ? '–' : '0',
        ptsClass: e.points ? 'text-ok' : 'text-muted',
        at: e.submitted_at,
      };
    }),
    ...((groupsRes.data ?? []) as GroupWorkoutScore[]).map((g) => ({
      key: g.id,
      who: selected.name,
      what: `Group workout with ${g.participant_count}: ${g.description}`,
      date: g.workout_date,
      tag: g.status === 'verified' ? 'Group workout, verified' : g.status === 'rejected' ? 'Group workout, rejected' : g.status === 'flagged' ? 'Group workout, flagged' : 'Group workout, awaiting verification',
      tone: (g.status === 'verified' ? 'info' : g.status === 'rejected' ? 'bad' : 'warn') as Tone,
      pts: g.team_points ? `+${g.team_points} team` : '–',
      ptsClass: g.team_points ? 'text-info' : 'text-muted',
      at: g.created_at,
    })),
    ...((penaltiesRes.data ?? []) as Penalty[]).map((p) => ({
      key: p.id,
      who: selected.name,
      what: p.reason,
      date: p.created_at.slice(0, 10),
      tag: 'Penalty',
      tone: 'bad' as Tone,
      pts: String(p.points).replace('-', '−'),
      ptsClass: 'text-bad',
      at: p.created_at,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);

  const dayNum = Math.max(0, Math.min(daysBetween(ctx.challenge.starts_on, ctx.today) + 1, daysBetween(ctx.challenge.starts_on, ctx.challenge.ends_on) + 1));
  const totalDays = daysBetween(ctx.challenge.starts_on, ctx.challenge.ends_on) + 1;

  return (
    <main className="page">
      <section>
        <div className="kicker">
          {ctx.challenge.name}, day {dayNum} of {totalDays}
        </div>
        <h1 className="h1 mt-1.5">Teams</h1>
      </section>

      <nav aria-label="Choose a team" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {standings.map((s) => {
          const active = s.team_id === selected.team_id;
          return (
            <Link
              key={s.team_id}
              href={`/teams?team=${s.team_id}`}
              aria-current={active ? 'true' : undefined}
              className={`flex flex-col gap-1.5 rounded-[14px] border-2 border-t-8 bg-white p-[18px] ${active ? 'border-ink' : 'border-transparent hover:border-edge'}`}
              style={{ borderTopColor: s.color }}
            >
              <span className="flex items-baseline justify-between">
                <span className="font-display text-[22px] font-bold">{s.name}</span>
                <span className="text-[13px] font-bold text-muted">{ordinal(s.rank)}</span>
              </span>
              <span className="font-display text-[32px] font-bold">
                {s.average.toFixed(1)} <span className="text-sm font-medium text-muted">avg</span>
              </span>
              <span className="mt-1 flex flex-col gap-0.5 border-t border-line pt-2 text-[13px]">
                <span className="flex justify-between gap-2">
                  <span className="text-muted">Captain</span>
                  <span className="truncate font-semibold">{personOf.get(s.captain_id ?? '')?.display_name ?? '—'}</span>
                </span>
                <span className="flex justify-between gap-2">
                  <span className="text-muted">Moderator</span>
                  <span className="truncate font-semibold">{personOf.get(s.moderator_id ?? '')?.display_name ?? '—'}</span>
                </span>
                <span className="flex justify-between gap-2">
                  <span className="text-muted">Members</span>
                  <span className="font-semibold">{s.member_count}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="card flex flex-wrap items-center gap-x-10 gap-y-4">
        <div className="flex-[1_1_260px]">
          <h2 className="font-display text-[28px] font-bold" style={{ color: selected.color }}>
            {selected.name}
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {[
              { label: 'Captain', person: personOf.get(selected.captain_id ?? ''), note: null as string | null, empty: 'Not chosen yet' },
              {
                label: 'Moderator',
                person: personOf.get(selected.moderator_id ?? ''),
                note: (() => {
                  const m = personOf.get(selected.moderator_id ?? '');
                  const t = m?.team_id ? ctx.teams.find((x) => x.id === m.team_id) : undefined;
                  return t ? `from ${t.name}` : null;
                })(),
                empty: 'Not assigned yet',
              },
            ].map(({ label, person, note, empty }) => (
              <div key={label} className="flex min-w-[180px] items-center gap-2.5 rounded-xl bg-ground px-3 py-2.5">
                {person && <Avatar name={person.display_name} src={person.avatar_url} color={tint(selected.color)} size={36} />}
                <div className="min-w-0 leading-tight">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
                  <div className="truncate font-semibold">{person ? person.display_name : <span className="font-normal text-muted">{empty}</span>}</div>
                  {note && <div className="text-xs text-muted">{note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <dl className="flex flex-wrap gap-6 tabular-nums">
          {[
            ['Individual', String(selected.individual_points), ''],
            ['Group bonus', `+${selected.bonus_points}`, ''],
            ['Penalties', selected.penalty_points ? String(selected.penalty_points).replace('-', '−') : '0', selected.penalty_points ? 'text-bad' : ''],
            ['Members', `÷ ${selected.member_count}`, ''],
          ].map(([label, value, cls]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className={`text-[22px] font-bold ${cls}`}>{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Average</dt>
            <dd className="font-display text-[28px] font-bold">{selected.average.toFixed(1)}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-wrap items-start gap-6">
        <div className="card min-w-0 flex-[1_1_380px]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="h2">Members</h2>
            <span className="text-[13px] text-muted">
              {uploadedToday.size} of {members.length} uploaded today
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse">
              <thead>
                <tr className="table-head">
                  <th className="py-2 pr-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Today</th>
                  <th className="py-2 pl-2 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-2.5 pr-2">
                      <span className="inline-flex items-center gap-2 align-middle">
                        <Avatar name={m.display_name} src={m.avatar_url} color={tint(selected.color)} size={28} />
                        <span className="font-semibold">{m.display_name}</span>
                      </span>
                      {m.id === selected.captain_id && (
                        <span className="ml-1.5">
                          <Pill tone="dark">Captain</Pill>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <Pill tone={uploadedToday.has(m.id) ? 'ok' : 'muted'}>{uploadedToday.has(m.id) ? 'Uploaded' : 'Not yet'}</Pill>
                    </td>
                    <td className="py-2.5 pl-2 text-right font-bold tabular-nums">{m.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card min-w-0 flex-[1_1_420px]">
          <h2 className="h2 mb-3">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-muted">No activity yet. Entries show up here as soon as they’re uploaded.</p>
          ) : (
            <ul>
              {activity.map((a) => (
                <li key={a.key} className="flex items-center gap-3 border-t border-line py-3">
                  <Avatar name={a.who === selected.name ? selected.name.slice(-1) : a.who} color={tint(selected.color)} />
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-semibold">{a.who}</span>, {a.what}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Pill tone={a.tone}>{a.tag}</Pill>
                      <span className="text-muted">{a.date === ctx.today ? 'Today' : formatDay(a.date)}</span>
                    </div>
                  </div>
                  <div className={`whitespace-nowrap font-display text-lg font-bold ${a.ptsClass}`}>{a.pts}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
