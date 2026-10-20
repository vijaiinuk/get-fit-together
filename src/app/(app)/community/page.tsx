import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getParticipants } from '@/lib/data';
import { formatDay, formatTime } from '@/lib/dates';
import { Avatar, tint } from '@/components/Avatar';
import { SubmitButton } from '@/components/SubmitButton';
import { addComment, createPost, hidePost, toggleLike } from './actions';
import { ActionForm } from '@/components/ActionForm';

type Post = { id: string; author_id: string; kind: 'post' | 'broadcast'; team_id: string | null; body: string; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };

export default async function CommunityPage() {
  const ctx = await getContext();
  const d = db();
  const [participants, postsRes, broadcastsRes] = await Promise.all([
    getParticipants(ctx.challenge.id),
    d.from('posts').select('*').eq('challenge_id', ctx.challenge.id).eq('kind', 'post').eq('hidden', false).order('created_at', { ascending: false }).limit(50),
    ctx.myTeam
      ? d.from('posts').select('*').eq('kind', 'broadcast').eq('team_id', ctx.myTeam.id).eq('hidden', false).order('created_at', { ascending: false }).limit(3)
      : Promise.resolve({ data: [] as Post[] }),
  ]);
  const posts = (postsRes.data ?? []) as Post[];
  const broadcasts = (broadcastsRes.data ?? []) as Post[];
  const ids = posts.map((p) => p.id);
  const [commentsRes, reactionsRes] = ids.length
    ? await Promise.all([
        d.from('comments').select('*').in('post_id', ids).order('created_at'),
        d.from('reactions').select('post_id, participant_id').in('post_id', ids),
      ])
    : [{ data: [] }, { data: [] }];

  const people = new Map(participants.map((p) => [p.id, p]));
  const teamOf = new Map(ctx.teams.map((t) => [t.id, t]));
  const comments = (commentsRes.data ?? []) as Comment[];
  const reactions = (reactionsRes.data ?? []) as { post_id: string; participant_id: string }[];
  const when = (ts: string) =>
    ts.slice(0, 10) === ctx.today ? `Today ${formatTime(ts, ctx.challenge.timezone)}` : formatDay(ts.slice(0, 10));

  return (
    <main className="page">
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
          <div>
            <div className="kicker">{ctx.challenge.name}</div>
            <h1 className="h1 mt-1.5">Community</h1>
          </div>

          <ActionForm action={createPost} className="card flex flex-col gap-3">
            {ctx.captainOf && (
              <fieldset className="flex flex-wrap gap-4">
                <legend className="sr-only">Who sees this</legend>
                <label className="flex min-h-[40px] items-center gap-2">
                  <input type="radio" name="kind" value="post" defaultChecked /> Post to everyone
                </label>
                <label className="flex min-h-[40px] items-center gap-2">
                  <input type="radio" name="kind" value="broadcast" /> Broadcast to {ctx.captainOf.name} only
                </label>
              </fieldset>
            )}
            <label htmlFor="body" className="text-[13px] text-muted">
              {ctx.captainOf
                ? 'Posts are visible to all teams. Broadcasts go only to your team and stay pinned at the top of their feed.'
                : 'Your post will be visible to all teams.'}
            </label>
            <textarea id="body" name="body" rows={3} required maxLength={2000} placeholder="Share a win, ask a question, cheer someone on…" className="input resize-y py-3" />
            <div className="flex justify-end">
              <SubmitButton pendingText="Posting…">Post</SubmitButton>
            </div>
          </ActionForm>

          {broadcasts.map((b) => (
            <article key={b.id} className="flex flex-col gap-2 rounded-[14px] bg-ink p-5 text-white">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-bold text-[#FFC078]">Captain broadcast, {teamOf.get(b.team_id ?? '')?.name} only</span>
                <span className="text-[#C9CED6]">
                  {people.get(b.author_id)?.display_name}, {when(b.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-line text-base leading-relaxed">{b.body}</p>
            </article>
          ))}

          {posts.length === 0 && <div className="card text-muted">No posts yet. Be the first to share how today went.</div>}

          {posts.map((p) => {
            const author = people.get(p.author_id);
            const team = author?.team_id ? teamOf.get(author.team_id) : undefined;
            const likes = reactions.filter((r) => r.post_id === p.id);
            const liked = likes.some((r) => r.participant_id === ctx.me.id);
            const thread = comments.filter((c) => c.post_id === p.id);
            return (
              <article key={p.id} className="card flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={author?.display_name ?? '?'} color={team ? tint(team.color) : undefined} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{author?.display_name ?? 'Former member'}</div>
                    <div className="text-[13px] text-muted">
                      {team?.name ?? 'No team'}, {when(p.created_at)}
                    </div>
                  </div>
                  {ctx.isAdmin && (
                    <ActionForm action={hidePost}>
                      <input type="hidden" name="post_id" value={p.id} />
                      <SubmitButton className="btn-outline btn-sm" pendingText="Hiding…">
                        Hide
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
                <p className="whitespace-pre-line leading-relaxed">{p.body}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <ActionForm action={toggleLike}>
                    <input type="hidden" name="post_id" value={p.id} />
                    <button
                      aria-pressed={liked}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line px-3.5 font-semibold ${liked ? 'bg-warnbg' : 'bg-white'}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
                      </svg>
                      <span>{likes.length}</span>
                      <span className="sr-only">{liked ? 'Unlike' : 'Like'}</span>
                    </button>
                  </ActionForm>
                  <span className="text-[13px] text-muted">{thread.length === 1 ? '1 comment' : `${thread.length} comments`}</span>
                </div>
                <div className="flex flex-col gap-2.5 border-t border-line pt-3">
                  {thread.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar name={people.get(c.author_id)?.display_name ?? '?'} size={28} />
                      <div className="min-w-0 flex-1 rounded-[10px] bg-ground px-3 py-2">
                        <span className="font-semibold">{people.get(c.author_id)?.display_name ?? 'Former member'}</span> {c.body}
                      </div>
                    </div>
                  ))}
                  <ActionForm action={addComment} className="flex gap-2">
                    <input type="hidden" name="post_id" value={p.id} />
                    <label htmlFor={`c-${p.id}`} className="sr-only">
                      Comment on {author?.display_name}’s post
                    </label>
                    <input id={`c-${p.id}`} name="body" required maxLength={1000} placeholder="Write a comment…" className="input flex-1" />
                    <SubmitButton className="btn-dark" pendingText="…">
                      Reply
                    </SubmitButton>
                  </ActionForm>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="card min-w-0 flex-[1_1_300px]">
          <h2 className="h2 mb-3 text-lg">Who can do what</h2>
          <div className="flex flex-col gap-2.5 text-sm leading-relaxed">
            <p>
              <span className="font-semibold">Everyone</span> posts, comments and reacts. Posts are visible to all teams.
            </p>
            <p>
              <span className="font-semibold">Captains</span> broadcast to their own team. Broadcasts stay pinned for that team.
            </p>
            <p>
              <span className="font-semibold">Admins</span> approve penalties and can hide posts.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
