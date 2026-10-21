import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { formatDay, formatTime } from '@/lib/dates';
import { tint } from '@/components/Avatar';
import { NotificationList, type NotificationItem } from './NotificationList';

type Row = {
  kind: 'like' | 'comment' | 'broadcast';
  actor_id: string;
  post_id: string;
  body: string | null;
  post_body: string | null;
  created_at: string;
  unread: boolean;
};

export default async function NotificationsPage() {
  const ctx = await getContext();
  const { data, error } = await db().rpc('member_notifications', { p_participant: ctx.me.id, p_limit: 50 });
  if (error) console.error('[notifications]', error);
  const rows = (data ?? []) as Row[];
  const people = new Map(ctx.people.map((p) => [p.id, p]));
  const teams = new Map(ctx.teams.map((t) => [t.id, t]));
  const when = (ts: string) =>
    ts.slice(0, 10) === ctx.today ? `Today ${formatTime(ts, ctx.challenge.timezone)}` : `${formatDay(ts.slice(0, 10))}, ${formatTime(ts, ctx.challenge.timezone)}`;

  const items: NotificationItem[] = rows.map((r, i) => {
    const actor = people.get(r.actor_id);
    const team = actor?.team_id ? teams.get(actor.team_id) : undefined;
    return {
      key: `${r.kind}-${r.post_id}-${r.actor_id}-${r.created_at}-${i}`,
      kind: r.kind,
      actor: actor?.display_name ?? 'Former member',
      actorAvatar: actor?.avatar_url ?? null,
      actorColor: team ? tint(team.color) : '#E7E9E3',
      href: `/community#post-${r.post_id}`,
      body: r.body,
      postBody: r.post_body,
      when: when(r.created_at),
      unread: r.unread,
    };
  });

  return (
    <main className="page max-w-[720px]">
      <section>
        <div className="kicker">{ctx.challenge.name}</div>
        <h1 className="h1 mt-1.5">Notifications</h1>
      </section>
      {error ? (
        <div className="card text-muted">Notifications aren’t available right now. Ask the admin to run the 0004 database update.</div>
      ) : (
        <NotificationList items={items} />
      )}
    </main>
  );
}
