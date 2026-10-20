import { getContext } from '@/lib/context';
import { getActivityTypes } from '@/lib/cached';
import { formatLongDay } from '@/lib/dates';
import { thresholdLabel } from '@/lib/format';
import type { ActivityType } from '@/lib/types';

export default async function RulesPage() {
  const ctx = await getContext();
  const c = ctx.challenge;
  const types: ActivityType[] = (await getActivityTypes(c.id)).filter((t) => t.enabled);
  const minuteTypes = types.filter((t) => t.unit === 'minutes');
  const stepTypes = types.filter((t) => t.unit === 'steps');

  const rules: [string, React.ReactNode][] = [
    ['Teams', 'Everyone is in a team. Each team has a captain who submits the team’s scorecard every day.'],
    ['Fair play', 'Each captain also moderates another team, checking their proofs before points count.'],
    [
      'Earning points',
      <>
        1 point for{' '}
        {minuteTypes.length > 0 &&
          `${thresholdLabel('minutes', minuteTypes[0].threshold)} of ${minuteTypes.map((t) => t.name.toLowerCase()).join(', ')}`}
        {minuteTypes.length > 0 && stepTypes.length > 0 && ', or '}
        {stepTypes.map((t) => `${thresholdLabel('steps', t.threshold)} a day`).join(', ')}. Maximum 1 point per person per day.
      </>,
    ],
    [
      'Group workouts',
      `${c.group_team_bonus} team point when ${c.group_min_members} or more teammates work out together. Each of them also earns their usual point for the day.`,
    ],
    ['Proof', 'A screenshot from your phone or smart device showing the workout. A gym photo is fine if you don’t have a device.'],
    ['Deadline', `Proof must be uploaded before midnight (${c.timezone.replace('_', ' ')} time) on the same day.`],
    ['Penalties', `−${c.fudge_penalty} points for any team found fudging numbers.`],
    ['Final score', 'At the end of the challenge: team total ÷ number of team members, so teams of different sizes compete fairly.'],
  ];

  return (
    <main className="page max-w-[820px]">
      <section>
        <div className="kicker">
          {c.name}, {formatLongDay(c.starts_on)} to {formatLongDay(c.ends_on)}
        </div>
        <h1 className="h1 mt-1.5">Rules</h1>
      </section>
      <ol className="card flex flex-col">
        {rules.map(([title, body], i) => (
          <li key={title} className="grid grid-cols-[32px_1fr] gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
            <span className="font-display text-lg font-bold text-muted">{i + 1}</span>
            <div>
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <p className="mt-1 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
