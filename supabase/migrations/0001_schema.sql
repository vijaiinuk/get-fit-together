-- FitLeague schema
-- All reads and writes go through the Next.js server using the service role key,
-- after the server has checked who the user is and what they are allowed to do.
-- Row level security is switched on with no policies, so the public anon key
-- cannot read or change any table directly.

create extension if not exists pgcrypto;

create table challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'Europe/London',
  group_min_members int not null default 3 check (group_min_members >= 2),
  group_team_bonus int not null default 1 check (group_team_bonus >= 0),
  fudge_penalty int not null default 5 check (fudge_penalty >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  name text not null,
  color text not null default '#6B7280',
  captain_id uuid,
  moderator_id uuid,
  created_at timestamptz not null default now(),
  unique (challenge_id, name)
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  display_name text not null,
  email text check (email is null or email = lower(email)),
  user_id uuid references auth.users(id) on delete set null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (challenge_id, email)
);
create unique index participants_user_once on participants (challenge_id, user_id) where user_id is not null;
create index participants_team on participants (team_id);

alter table teams
  add constraint teams_captain_fk foreign key (captain_id) references participants(id) on delete set null,
  add constraint teams_moderator_fk foreign key (moderator_id) references participants(id) on delete set null;

create table activity_types (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('minutes', 'steps')),
  threshold int not null check (threshold > 0),
  enabled boolean not null default true,
  sort int not null default 0,
  unique (challenge_id, name)
);

-- One entry per person per day. That enforces the "max 1 point per person per day" rule.
create table entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  entry_date date not null,
  activity_type_id uuid not null references activity_types(id),
  quantity int not null check (quantity >= 0),
  proof_path text not null,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references participants(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'flagged')),
  review_note text,
  reviewed_by uuid references participants(id) on delete set null,
  reviewed_at timestamptz,
  unique (participant_id, entry_date)
);
create index entries_team_date on entries (team_id, entry_date);

create table group_workouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  workout_date date not null,
  description text not null,
  proof_path text not null,
  created_by uuid references participants(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewed_by uuid references participants(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, workout_date)
);

create table group_workout_participants (
  group_workout_id uuid not null references group_workouts(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  primary key (group_workout_id, participant_id)
);

create table scorecards (
  team_id uuid not null references teams(id) on delete cascade,
  score_date date not null,
  status text not null default 'submitted' check (status in ('submitted', 'verified')),
  submitted_by uuid references participants(id) on delete set null,
  submitted_at timestamptz not null default now(),
  verified_by uuid references participants(id) on delete set null,
  verified_at timestamptz,
  primary key (team_id, score_date)
);

-- Penalty points are stored as negative numbers, e.g. -5.
create table penalties (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  points int not null check (points < 0),
  reason text not null,
  entry_id uuid references entries(id) on delete set null,
  issued_by uuid references participants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  author_id uuid not null references participants(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'broadcast')),
  team_id uuid references teams(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind = 'post' or team_id is not null)
);
create index posts_challenge_created on posts (challenge_id, created_at desc);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references participants(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table reactions (
  post_id uuid not null references posts(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  primary key (post_id, participant_id)
);

-- Scoring views ---------------------------------------------------------------

-- An entry earns 1 point once a moderator has verified it and it meets the threshold.
create view entry_scores with (security_invoker = on) as
select
  e.*,
  a.name as activity_name,
  a.unit,
  a.threshold,
  case when e.status = 'verified' and e.quantity >= a.threshold then 1 else 0 end as points
from entries e
join activity_types a on a.id = e.activity_type_id;

-- A group workout earns the team bonus once verified, if enough teammates took part.
create view group_workout_scores with (security_invoker = on) as
select
  g.*,
  coalesce(p.cnt, 0)::int as participant_count,
  case when g.status = 'verified' and coalesce(p.cnt, 0) >= c.group_min_members
       then c.group_team_bonus else 0 end as team_points
from group_workouts g
join teams t on t.id = g.team_id
join challenges c on c.id = t.challenge_id
left join (
  select group_workout_id, count(*) as cnt
  from group_workout_participants
  group by group_workout_id
) p on p.group_workout_id = g.id;

-- Team totals. The average (total / members) is worked out in the app.
create view team_scores with (security_invoker = on) as
select
  t.id as team_id,
  t.challenge_id,
  t.name,
  t.color,
  t.captain_id,
  t.moderator_id,
  coalesce((select sum(es.points) from entry_scores es where es.team_id = t.id), 0)::int as individual_points,
  coalesce((select sum(g.team_points) from group_workout_scores g where g.team_id = t.id), 0)::int as bonus_points,
  coalesce((select sum(p.points) from penalties p where p.team_id = t.id), 0)::int as penalty_points,
  (select count(*) from participants pa where pa.team_id = t.id)::int as member_count
from teams t;

-- Lock everything down for the public keys -----------------------------------

alter table challenges enable row level security;
alter table teams enable row level security;
alter table participants enable row level security;
alter table activity_types enable row level security;
alter table entries enable row level security;
alter table group_workouts enable row level security;
alter table group_workout_participants enable row level security;
alter table scorecards enable row level security;
alter table penalties enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table reactions enable row level security;

revoke all on entry_scores, group_workout_scores, team_scores from anon, authenticated;

-- The app talks to the database only as service_role. Grant it explicitly rather than relying on
-- the project's default privileges, which can differ between Supabase projects.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Private bucket for proof images. Uploads use short-lived signed upload URLs
-- created by the server, and images are shown through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
