import Link from 'next/link';
import { Avatar, tint } from './Avatar';
import { ordinal } from '@/lib/data';
import { score } from '@/lib/format';

type Person = { name: string; isMe: boolean; teamName?: string | null; avatarUrl?: string | null } | null;

// "Who's who" for the signed-in member: their team, its captain and moderator, and how the team is doing.
export function TeamCard({
  team,
  rank,
  teamCount,
  total,
  members,
  loggedToday,
  captain,
  moderator,
  showToday,
}: {
  team: { id: string; name: string; color: string };
  rank: number | null;
  teamCount: number;
  total: number;
  members: number;
  loggedToday: number;
  captain: Person;
  moderator: Person;
  showToday: boolean;
}) {
  const pct = members > 0 ? Math.round((loggedToday / members) * 100) : 0;

  return (
    <section aria-labelledby="my-team" className="overflow-hidden rounded-[14px] bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-4 text-white sm:px-6" style={{ background: team.color }}>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold opacity-90">Your team</div>
          <h2 id="my-team" className="truncate font-display text-2xl font-bold">
            {team.name}
          </h2>
        </div>
        {rank && (
          <div className="flex-none rounded-xl bg-white/20 px-3 py-1.5 text-right leading-tight">
            <div className="font-display text-xl font-bold">{ordinal(rank)}</div>
            <div className="text-[11px] font-semibold opacity-90">of {teamCount}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Role label="Captain" person={captain} color={tint(team.color)} empty="Not chosen yet" />
          <Role label="Moderator" person={moderator} color="#E7E9E3" empty="Not assigned yet" />
        </dl>

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-center">
          <div>
            <div className={`font-display text-2xl font-bold tabular-nums ${total < 0 ? 'text-bad' : ''}`}>{score(total)}</div>
            <div className="text-xs text-muted">team points</div>
          </div>
          <div>
            <div className="font-display text-2xl font-bold tabular-nums">{members}</div>
            <div className="text-xs text-muted">members</div>
          </div>
        </div>

        {showToday && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold">Logged today</span>
              <span className="tabular-nums text-muted">
                {loggedToday} of {members}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Team members who logged today">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: team.color }} />
            </div>
          </div>
        )}

        <Link href={`/teams?team=${team.id}`} className="btn-outline btn-sm w-full">
          See team and members
        </Link>
      </div>
    </section>
  );
}

function Role({ label, person, color, empty }: { label: string; person: Person; color: string; empty: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-ground p-3">
      {person && <Avatar name={person.name} color={color} size={36} src={person.avatarUrl} />}
      <div className="min-w-0">
        <dt className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="truncate font-semibold">
          {person ? (person.isMe ? `${person.name} (you)` : person.name) : <span className="font-normal text-muted">{empty}</span>}
        </dd>
        {person?.teamName && <dd className="truncate text-xs text-muted">from {person.teamName}</dd>}
      </div>
    </div>
  );
}
