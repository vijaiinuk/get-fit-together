'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CONFIG_TAG, PEOPLE_TAG } from '@/lib/cached';
import { db } from '@/lib/supabase/admin';
import { requireAdmin, type Ctx } from '@/lib/context';
import { str } from '@/lib/guards';

function done() {
  revalidateTag(CONFIG_TAG);
  revalidateTag(PEOPLE_TAG);
  revalidatePath('/', 'layout');
}

function cleanEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error(`“${raw}” isn’t a valid email address.`);
  return e;
}

function teamOrNull(ctx: Ctx, id: string): string | null {
  if (!id) return null;
  if (!ctx.teams.some((t) => t.id === id)) throw new Error('Team not found.');
  return id;
}

async function participantInChallenge(ctx: Ctx, id: string) {
  const { data } = await db().from('participants').select('*').eq('id', id).maybeSingle();
  if (!data || data.challenge_id !== ctx.challenge.id) throw new Error('Member not found.');
  return data;
}

async function addParticipantImpl(form: FormData) {
  const ctx = await requireAdmin();
  const name = str(form, 'display_name').slice(0, 60);
  if (!name) throw new Error('Enter a name.');
  const { error } = await db().from('participants').insert({
    challenge_id: ctx.challenge.id,
    display_name: name,
    email: cleanEmail(str(form, 'email')),
    team_id: teamOrNull(ctx, str(form, 'team_id')),
  });
  if (error) throw new Error('Someone with that email is already on the list.');
  done();
}

async function updateParticipantImpl(form: FormData) {
  const ctx = await requireAdmin();
  const p = await participantInChallenge(ctx, str(form, 'id'));
  const name = str(form, 'display_name').slice(0, 60);
  if (!name) throw new Error('Enter a name.');
  const email = cleanEmail(str(form, 'email'));
  const teamId = teamOrNull(ctx, str(form, 'team_id'));
  const isAdmin = form.get('is_admin') === 'on';
  if (p.id === ctx.me.id && !isAdmin) throw new Error('You can’t remove your own admin access.');

  const update: Record<string, unknown> = { display_name: name, email, team_id: teamId, is_admin: isAdmin };
  // Changing the email unlinks the old login so the new address can sign in.
  if (email !== p.email) update.user_id = null;
  const { error } = await db().from('participants').update(update).eq('id', p.id);
  if (error) throw new Error('Someone else already uses that email.');

  // If they left a team they captained or moderated, clear those roles.
  if (teamId !== p.team_id) {
    await must(db().from('teams').update({ captain_id: null }).eq('captain_id', p.id).neq('id', teamId ?? '00000000-0000-0000-0000-000000000000'));
    if (teamId) await must(db().from('teams').update({ moderator_id: null }).eq('id', teamId).eq('moderator_id', p.id));
  }
  done();
}

async function createTeamImpl(form: FormData) {
  const ctx = await requireAdmin();
  const name = str(form, 'name').slice(0, 40);
  const color = /^#[0-9a-fA-F]{6}$/.test(str(form, 'color')) ? str(form, 'color') : '#6B7280';
  if (!name) throw new Error('Enter a team name.');
  const { error } = await db().from('teams').insert({ challenge_id: ctx.challenge.id, name, color });
  if (error) throw new Error('A team with that name already exists.');
  done();
}

async function updateTeamImpl(form: FormData) {
  const ctx = await requireAdmin();
  const teamId = teamOrNull(ctx, str(form, 'team_id'));
  if (!teamId) throw new Error('Team not found.');
  const name = str(form, 'name').replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new Error('Enter a team name.');
  const color = str(form, 'color');
  const update: Record<string, string> = { name };
  if (/^#[0-9a-fA-F]{6}$/.test(color)) update.color = color;
  const { error } = await db().from('teams').update(update).eq('id', teamId);
  if (error) {
    console.error('[updateTeam]', error);
    throw new Error(error.code === '23505' ? 'Another team already has that name.' : 'Could not save the team. Try again.');
  }
  done();
}

// Deletes a team, but only an empty one with no history. The database would otherwise cascade the
// delete to its entries, group workouts, scorecards, penalties and team news, erasing points for good.
async function deleteTeamImpl(form: FormData) {
  const ctx = await requireAdmin();
  const teamId = teamOrNull(ctx, str(form, 'team_id'));
  if (!teamId) throw new Error('Team not found.');
  const d = db();
  const count = async (table: string) => {
    const { count, error } = await d.from(table).select('*', { count: 'exact', head: true }).eq('team_id', teamId);
    if (error) throw new Error('Could not check the team. Try again.');
    return count ?? 0;
  };
  const [members, entries, groups, penalties, posts] = await Promise.all([
    count('participants'),
    count('entries'),
    count('group_workouts'),
    count('penalties'),
    count('posts'),
  ]);
  if (members) throw new Error(`Move its ${members} member${members === 1 ? '' : 's'} to another team first (in the Members list below).`);
  const history = [
    entries && `${entries} entr${entries === 1 ? 'y' : 'ies'}`,
    groups && `${groups} group workout${groups === 1 ? '' : 's'}`,
    penalties && `${penalties} penalt${penalties === 1 ? 'y' : 'ies'}`,
    posts && `${posts} team news post${posts === 1 ? '' : 's'}`,
  ].filter(Boolean);
  if (history.length) {
    throw new Error(`This team has ${history.join(', ')}. Deleting it would erase that history and its points, so it can't be deleted.`);
  }
  // Nobody should be left moderating or captaining a team that no longer exists.
  await must(d.from('teams').update({ moderator_id: null, captain_id: null }).eq('id', teamId));
  await must(d.from('scorecards').delete().eq('team_id', teamId));
  await must(d.from('teams').delete().eq('id', teamId), 'Could not delete the team. Try again.');
  done();
}

async function setCaptainImpl(form: FormData) {
  const ctx = await requireAdmin();
  const teamId = teamOrNull(ctx, str(form, 'team_id'));
  const pid = str(form, 'participant_id');
  if (!teamId) throw new Error('Team not found.');
  if (pid) {
    const p = await participantInChallenge(ctx, pid);
    if (p.team_id !== teamId) throw new Error('The captain must be a member of the team.');
  }
  await must(db().from('teams').update({ captain_id: pid || null }).eq('id', teamId));
  done();
}

async function setModeratorImpl(form: FormData) {
  const ctx = await requireAdmin();
  const teamId = teamOrNull(ctx, str(form, 'team_id'));
  const pid = str(form, 'participant_id');
  if (!teamId) throw new Error('Team not found.');
  if (pid) {
    const p = await participantInChallenge(ctx, pid);
    if (p.team_id === teamId) throw new Error('A moderator must come from a different team.');
  }
  await must(db().from('teams').update({ moderator_id: pid || null }).eq('id', teamId));
  done();
}

export const addParticipant = safe(addParticipantImpl);
export const updateParticipant = safe(updateParticipantImpl);
export const createTeam = safe(createTeamImpl);
export const updateTeam = safe(updateTeamImpl);
export const deleteTeam = safe(deleteTeamImpl);
export const setCaptain = safe(setCaptainImpl);
export const setModerator = safe(setModeratorImpl);
