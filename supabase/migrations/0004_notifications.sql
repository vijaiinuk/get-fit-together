-- Notifications: likes and replies on your posts, and team news from your captain.
-- Worked out from existing tables when read, so nothing extra is written when someone posts or likes.
-- Run after 0003. Safe to run more than once.

alter table reactions add column if not exists created_at timestamptz not null default now();
-- Starts at "now" so existing members don't open the page to a pile of old unread items.
alter table participants add column if not exists notifications_seen_at timestamptz not null default now();

create index if not exists posts_team_kind on posts (team_id, kind, created_at desc);
create index if not exists posts_author on posts (author_id);
create index if not exists comments_post on comments (post_id);

create or replace function member_notifications(p_participant uuid, p_limit int default 50)
returns table (kind text, actor_id uuid, post_id uuid, body text, post_body text, created_at timestamptz, unread boolean)
language sql stable
as $$
  with me as (
    select id, team_id, notifications_seen_at as seen from participants where id = p_participant
  ),
  items as (
    select 'like'::text as kind, r.participant_id as actor_id, p.id as post_id,
           null::text as body, p.body as post_body, r.created_at as created_at
    from reactions r join posts p on p.id = r.post_id cross join me
    where p.author_id = me.id and r.participant_id <> me.id and not p.hidden
    union all
    select 'comment', c.author_id, p.id, c.body, p.body, c.created_at
    from comments c join posts p on p.id = c.post_id cross join me
    where p.author_id = me.id and c.author_id <> me.id and not p.hidden
    union all
    select 'broadcast', p.author_id, p.id, p.body, null, p.created_at
    from posts p cross join me
    where p.kind = 'broadcast' and p.team_id = me.team_id and p.author_id <> me.id and not p.hidden
  )
  select i.kind, i.actor_id, i.post_id, i.body, i.post_body, i.created_at, i.created_at > me.seen
  from items i cross join me
  order by i.created_at desc
  limit p_limit;
$$;

create or replace function member_unread_count(p_participant uuid)
returns int
language sql stable
as $$
  select count(*)::int from member_notifications(p_participant, 1000) n where n.unread;
$$;

-- Functions in the public schema are callable with the public anon key unless revoked.
-- Only the server (service_role) may call these.
revoke all on function member_notifications(uuid, int) from public, anon, authenticated;
revoke all on function member_unread_count(uuid) from public, anon, authenticated;
grant execute on function member_notifications(uuid, int) to service_role;
grant execute on function member_unread_count(uuid) to service_role;
