-- Profile page: members can set an alias (shown instead of their name) and a profile picture.
-- Run after 0002. Safe to run more than once.

alter table participants add column if not exists alias text;
alter table participants drop constraint if exists participants_alias_check;
alter table participants add constraint participants_alias_check
  check (alias is null or char_length(btrim(alias)) between 1 and 30);
alter table participants add column if not exists avatar_path text;

-- Private bucket: pictures are shown through signed links, like proofs. Small files only,
-- because the browser crops and shrinks them to 320x320 before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
