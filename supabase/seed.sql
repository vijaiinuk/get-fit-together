-- Seed: Bodhi & Hridhi Hustle
-- Before running, change the dates, timezone and admin email below.
-- Members' emails can be added later from Admin > Teams & members.
-- Someone can sign in once their email is on their participant record.

do $$
declare
  c uuid;
  ta uuid; tb uuid; tc uuid; td uuid;
  admin_email text := 'replace-with-your-email@example.com';  -- <== your email, lower case
begin
  insert into challenges (name, starts_on, ends_on, timezone)
  values ('Bodhi & Hridhi Hustle', date '2026-11-01', date '2026-11-30', 'Europe/London')
  returning id into c;

  insert into activity_types (challenge_id, name, unit, threshold, sort) values
    (c, 'Gym', 'minutes', 40, 1),
    (c, 'Sport', 'minutes', 40, 2),
    (c, 'Yoga', 'minutes', 40, 3),
    (c, 'Brisk walk', 'minutes', 40, 4),
    (c, 'Steps', 'steps', 8000, 5);

  insert into teams (challenge_id, name, color) values (c, 'Team A', '#2563A8') returning id into ta;
  insert into teams (challenge_id, name, color) values (c, 'Team B', '#2F7D4A') returning id into tb;
  insert into teams (challenge_id, name, color) values (c, 'Team C', '#B86E12') returning id into tc;
  insert into teams (challenge_id, name, color) values (c, 'Team D', '#6B3F86') returning id into td;

  insert into participants (challenge_id, team_id, display_name)
  select c, ta, n from unnest(array['Merin','Abi','Anjana','Ganesh','Ishani','Kanniga Vinodhini','Priya','Malar','Navin','Saranya (Hridhi)','Vishnu']) as n;
  insert into participants (challenge_id, team_id, display_name)
  select c, tb, n from unnest(array['Rajeshwari','Ahila','Divya','Karthik','Majisha','Swaathi','Aajisha','Nila','Revathi','Sengottuvel Vanitha','Deepika','Nivvi']) as n;
  insert into participants (challenge_id, team_id, display_name)
  select c, tc, n from unnest(array['Prabha','Balaguru','Gayatri','Kamatchi Mallaya','Mamta Girish','Mohanraj','Nithi','Saranya Bodhi','Sinthiya','Suma','Tara']) as n;
  insert into participants (challenge_id, team_id, display_name)
  select c, td, n from unnest(array['Vimeeka','Priya Krishnakumar','Srikanth Rajan','Swathi V Anand','Thiayagu','Vijay','Vijaya','Vikashini','Vimala Devi','Anu Arya','Preethi']) as n;

  -- You (Vijay, Team D) are the admin.
  update participants set is_admin = true, email = lower(admin_email)
  where challenge_id = c and display_name = 'Vijay';

  -- Captains
  update teams set captain_id = (select id from participants where challenge_id = c and display_name = 'Merin') where id = ta;
  update teams set captain_id = (select id from participants where challenge_id = c and display_name = 'Rajeshwari') where id = tb;
  update teams set captain_id = (select id from participants where challenge_id = c and display_name = 'Prabha') where id = tc;
  update teams set captain_id = (select id from participants where challenge_id = c and display_name = 'Vimeeka') where id = td;

  -- Moderators: each team is checked by the next team's captain.
  update teams set moderator_id = (select captain_id from teams where id = tb) where id = ta;
  update teams set moderator_id = (select captain_id from teams where id = tc) where id = tb;
  update teams set moderator_id = (select captain_id from teams where id = td) where id = tc;
  update teams set moderator_id = (select captain_id from teams where id = ta) where id = td;
end $$;
