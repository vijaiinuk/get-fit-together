-- Lets moderators flag a group workout to the admins with a note, like individual entries.
-- Run this after 0001_schema.sql. Safe to run more than once.

alter table group_workouts add column if not exists review_note text;
alter table group_workouts drop constraint if exists group_workouts_status_check;
alter table group_workouts
  add constraint group_workouts_status_check check (status in ('pending', 'verified', 'rejected', 'flagged'));

-- The views expand g.* when they are created, so recreate them to pick up review_note.
drop view if exists team_scores;
drop view if exists group_workout_scores;

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

revoke all on group_workout_scores, team_scores from anon, authenticated;
grant select on group_workout_scores, team_scores to service_role;
