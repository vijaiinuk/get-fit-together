'use server';

import { must, safe } from '@/lib/safe';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext, type Ctx } from '@/lib/context';
import { str } from '@/lib/guards';

// Posts are open to everyone in the challenge. A broadcast is only visible to its team, so only that
// team (and admins) can like or reply to it.
async function postForInteraction(ctx: Ctx, postId: string) {
  const { data: post } = await db().from('posts').select('challenge_id, kind, team_id').eq('id', postId).maybeSingle();
  if (!post || post.challenge_id !== ctx.challenge.id) throw new Error('That post was not found.');
  if (post.kind === 'broadcast' && !ctx.isAdmin && ctx.myTeam?.id !== post.team_id) {
    throw new Error('Only members of that team can reply to its news.');
  }
  return post;
}

function refresh() {
  revalidatePath('/community');
  revalidatePath('/');
}

async function createPostImpl(form: FormData) {
  const ctx = await getContext();
  const body = str(form, 'body').slice(0, 2000);
  if (!body) return;
  const broadcast = str(form, 'kind') === 'broadcast';
  if (broadcast && !ctx.captainOf) throw new Error('Only captains can broadcast to a team.');
  const { error } = await db().from('posts').insert({
    challenge_id: ctx.challenge.id,
    author_id: ctx.me.id,
    kind: broadcast ? 'broadcast' : 'post',
    team_id: broadcast ? ctx.captainOf!.id : null,
    body,
  });
  if (error) throw new Error('Could not post that. Try again.');
  revalidatePath('/community');
  revalidatePath('/');
}

async function addCommentImpl(form: FormData) {
  const ctx = await getContext();
  const body = str(form, 'body').slice(0, 1000);
  const postId = str(form, 'post_id');
  if (!body || !postId) return;
  await postForInteraction(ctx, postId);
  await must(db().from('comments').insert({ post_id: postId, author_id: ctx.me.id, body }));
  refresh();
}

async function toggleLikeImpl(form: FormData) {
  const ctx = await getContext();
  const postId = str(form, 'post_id');
  const d = db();
  await postForInteraction(ctx, postId);
  const { data: existing } = await d
    .from('reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('participant_id', ctx.me.id)
    .maybeSingle();
  if (existing) await must(d.from('reactions').delete().eq('post_id', postId).eq('participant_id', ctx.me.id));
  else await must(d.from('reactions').insert({ post_id: postId, participant_id: ctx.me.id }));
  refresh();
}

async function hidePostImpl(form: FormData) {
  const ctx = await getContext();
  if (!ctx.isAdmin) throw new Error('Only admins can hide posts.');
  await must(db().from('posts').update({ hidden: true }).eq('id', str(form, 'post_id')).eq('challenge_id', ctx.challenge.id));
  revalidatePath('/community');
}

export const createPost = safe(createPostImpl);
export const addComment = safe(addCommentImpl);
export const toggleLike = safe(toggleLikeImpl);
export const hidePost = safe(hidePostImpl);
