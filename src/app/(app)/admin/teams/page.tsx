import { requireAdmin } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getParticipants } from '@/lib/data';
import { SubmitButton } from '@/components/SubmitButton';
import { Pill } from '@/components/Pill';
import { AdminTabs } from '../AdminTabs';
import { addParticipant, createTeam, setCaptain, setModerator, updateParticipant } from './actions';
import { ActionForm } from '@/components/ActionForm';

export default async function AdminTeamsPage() {
  const ctx = await requireAdmin();
  const participants = await getParticipants(ctx.challenge.id);
  const { count: flagged } = await db()
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', ctx.challenge.id)
    .eq('status', 'flagged');
  const captains = new Set(ctx.teams.map((t) => t.captain_id).filter(Boolean));
  const noEmail = participants.filter((p) => !p.email).length;
  const teamOptions = (
    <>
      <option value="">No team</option>
      {ctx.teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );

  return (
    <main className="page">
      <section>
        <div className="kicker">Admin, {ctx.challenge.name}</div>
        <h1 className="h1 mt-1.5">Teams & members</h1>
        <p className="mt-2 max-w-[680px] text-muted">
          Pick a captain for each team and a moderator from another team. Add each person’s email so they can sign in.
        </p>
      </section>
      <AdminTabs active="teams" flagged={flagged ?? 0} />

      <section className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
        {ctx.teams.map((t) => {
          const members = participants.filter((p) => p.team_id === t.id);
          const others = participants.filter((p) => p.team_id && p.team_id !== t.id);
          return (
            <div key={t.id} className="card flex flex-col gap-3.5 border-t-[6px]" style={{ borderTopColor: t.color }}>
              <div className="flex items-baseline justify-between">
                <h2 className="h2">{t.name}</h2>
                <span className="text-[13px] text-muted">{members.length} members</span>
              </div>
              <ActionForm action={setCaptain} className="flex flex-col gap-1.5">
                <input type="hidden" name="team_id" value={t.id} />
                <label htmlFor={`cap-${t.id}`} className="label">
                  Captain
                </label>
                <div className="flex gap-2">
                  <select id={`cap-${t.id}`} name="participant_id" defaultValue={t.captain_id ?? ''} className="input">
                    <option value="">None</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn-dark btn-sm">Set</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={setModerator} className="flex flex-col gap-1.5">
                <input type="hidden" name="team_id" value={t.id} />
                <label htmlFor={`mod-${t.id}`} className="label">
                  Moderator
                </label>
                <div className="flex gap-2">
                  <select id={`mod-${t.id}`} name="participant_id" defaultValue={t.moderator_id ?? ''} className="input">
                    <option value="">None</option>
                    {others
                      .sort((a, b) => Number(captains.has(b.id)) - Number(captains.has(a.id)) || a.display_name.localeCompare(b.display_name))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                          {captains.has(m.id) ? ' (captain)' : ''}
                        </option>
                      ))}
                  </select>
                  <SubmitButton className="btn-dark btn-sm">Set</SubmitButton>
                </div>
              </ActionForm>
            </div>
          );
        })}
        <ActionForm action={createTeam} className="card flex flex-col gap-3 border-2 border-dashed border-edge">
          <h2 className="h2">New team</h2>
          <label htmlFor="team-name" className="label">
            Name
          </label>
          <input id="team-name" name="name" required placeholder="e.g. Team E" className="input" />
          <label htmlFor="team-color" className="label">
            Colour
          </label>
          <input id="team-color" name="color" type="color" defaultValue="#0E7490" className="h-11 w-20 rounded-lg border border-edge" />
          <SubmitButton>Create team</SubmitButton>
        </ActionForm>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">Members</h2>
          <span className="text-[13px] text-muted">
            {participants.length} people{noEmail ? `, ${noEmail} still need an email to sign in` : ''}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="table-head grid grid-cols-[1.2fr_1.6fr_1fr_80px_90px_96px] gap-3 py-2">
              <span>Name</span>
              <span>Email</span>
              <span>Team</span>
              <span>Admin</span>
              <span>Signed in</span>
              <span />
            </div>
            {participants.map((p) => (
              <ActionForm key={p.id} action={updateParticipant} className="grid grid-cols-[1.2fr_1.6fr_1fr_80px_90px_96px] items-center gap-3 border-t border-line py-2.5">
                <input type="hidden" name="id" value={p.id} />
                <div className="flex flex-col gap-0.5">
                  <input name="display_name" defaultValue={p.full_name ?? p.display_name} aria-label={`Name for ${p.full_name ?? p.display_name}`} className="input" required />
                  {p.alias && <span className="truncate text-xs text-muted">Shows as “{p.alias}”</span>}
                </div>
                <input name="email" type="email" defaultValue={p.email ?? ''} placeholder="name@example.com" aria-label={`Email for ${p.display_name}`} className="input" />
                <select name="team_id" defaultValue={p.team_id ?? ''} aria-label={`Team for ${p.display_name}`} className="input">
                  {teamOptions}
                </select>
                <input type="checkbox" name="is_admin" defaultChecked={p.is_admin} aria-label={`${p.display_name} is an admin`} className="h-5 w-5" />
                <span>{p.user_id ? <Pill tone="ok">Yes</Pill> : <Pill tone="muted">Not yet</Pill>}</span>
                <SubmitButton className="btn-outline btn-sm">Save</SubmitButton>
              </ActionForm>
            ))}
          </div>
        </div>
        <ActionForm action={addParticipant} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <div className="flex flex-[1_1_180px] flex-col gap-1.5">
            <label htmlFor="new-name" className="label">
              Add a person
            </label>
            <input id="new-name" name="display_name" required placeholder="Name" className="input" />
          </div>
          <div className="flex flex-[1.4_1_220px] flex-col gap-1.5">
            <label htmlFor="new-email" className="label">
              Email
            </label>
            <input id="new-email" name="email" type="email" placeholder="name@example.com" className="input" />
          </div>
          <div className="flex flex-[1_1_140px] flex-col gap-1.5">
            <label htmlFor="new-team" className="label">
              Team
            </label>
            <select id="new-team" name="team_id" className="input">
              {teamOptions}
            </select>
          </div>
          <SubmitButton>Add person</SubmitButton>
        </ActionForm>
      </section>
    </main>
  );
}
