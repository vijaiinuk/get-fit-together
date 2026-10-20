import { requireAdmin } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { getActivityTypes } from '@/lib/cached';
import { getParticipants, signedProofUrls } from '@/lib/data';
import { formatDay } from '@/lib/dates';
import { formatQuantity, thresholdLabel } from '@/lib/format';
import type { ActivityType, EntryScore, GroupWorkoutScore, Penalty } from '@/lib/types';
import { ProofImage } from '@/components/ProofImage';
import { SubmitButton } from '@/components/SubmitButton';
import { AdminTabs } from './AdminTabs';
import { addActivity, addPenalty, deletePenalty, resolveFlag, resolveGroupFlag, saveRules, toggleActivity } from './actions';
import { ActionForm } from '@/components/ActionForm';

export default async function AdminPage() {
  const ctx = await requireAdmin();
  const c = ctx.challenge;
  const d = db();
  const teamIds = ctx.teams.map((t) => t.id).concat('00000000-0000-0000-0000-000000000000');
  const [typesRes, flaggedRes, penaltiesRes, participants, flaggedGwRes] = await Promise.all([
    getActivityTypes(c.id).then((data) => ({ data })),
    d.from('entry_scores').select('*').eq('challenge_id', c.id).eq('status', 'flagged').order('entry_date'),
    d.from('penalties').select('*').in('team_id', teamIds).order('created_at', { ascending: false }),
    getParticipants(c.id),
    d.from('group_workout_scores').select('*').in('team_id', teamIds).eq('status', 'flagged').order('workout_date'),
  ]);
  const flaggedGw = (flaggedGwRes.data ?? []) as GroupWorkoutScore[];
  const types = (typesRes.data ?? []) as ActivityType[];
  const flagged = (flaggedRes.data ?? []) as EntryScore[];
  const penalties = (penaltiesRes.data ?? []) as Penalty[];
  const nameOf = new Map(participants.map((p) => [p.id, p.display_name]));
  const teamName = new Map(ctx.teams.map((t) => [t.id, t.name]));
  const urls = await signedProofUrls([...flagged.map((f) => f.proof_path), ...flaggedGw.map((g) => g.proof_path)]);

  return (
    <main className="page">
      <section>
        <div className="kicker">Admin, {c.name}</div>
        <h1 className="h1 mt-1.5">Scoring & flags</h1>
        <p className="mt-2 max-w-[640px] text-muted">Set which activities qualify, the scoring rules, and decide on entries moderators flag.</p>
      </section>
      <AdminTabs active="activities" flagged={flagged.length + flaggedGw.length} />

      <section className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          <div className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="h2">Qualifying activities</h2>
              <span className="text-[13px] text-muted">Each earns 1 point when the threshold is met</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="table-head">
                    <th className="py-2 pr-2 font-semibold">Activity</th>
                    <th className="px-2 py-2 font-semibold">Threshold</th>
                    <th className="py-2 pl-2 text-right font-semibold">Counts</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.id} className={`border-t border-line ${t.enabled ? '' : 'opacity-50'}`}>
                      <td className="py-3.5 pr-2 font-semibold">{t.name}</td>
                      <td className="px-2 py-3.5">{thresholdLabel(t.unit, t.threshold)}</td>
                      <td className="py-3.5 pl-2 text-right">
                        <ActionForm action={toggleActivity}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            aria-pressed={t.enabled}
                            aria-label={`${t.enabled ? 'Turn off' : 'Turn on'} ${t.name}`}
                            className={`relative h-[30px] w-[52px] rounded-full ${t.enabled ? 'bg-accent' : 'bg-edge'}`}
                          >
                            <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white transition-[left] ${t.enabled ? 'left-[25px]' : 'left-[3px]'}`} />
                          </button>
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionForm action={addActivity} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
              <div className="flex flex-[2_1_200px] flex-col gap-1.5">
                <label htmlFor="act-name" className="label">
                  Add activity
                </label>
                <input id="act-name" name="name" required placeholder="e.g. Swimming" className="input" />
              </div>
              <div className="flex flex-[1_1_110px] flex-col gap-1.5">
                <label htmlFor="act-thr" className="label">
                  Threshold
                </label>
                <input id="act-thr" name="threshold" type="number" min={1} required placeholder="40" className="input" />
              </div>
              <div className="flex flex-[1_1_120px] flex-col gap-1.5">
                <label htmlFor="act-unit" className="label">
                  Unit
                </label>
                <select id="act-unit" name="unit" className="input">
                  <option value="minutes">Minutes</option>
                  <option value="steps">Steps</option>
                </select>
              </div>
              <SubmitButton>Add</SubmitButton>
            </ActionForm>
          </div>

          <ActionForm action={saveRules} className="card flex flex-col gap-4">
            <h2 className="h2">Challenge settings</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              <Field label="Challenge name" name="name" defaultValue={c.name} />
              <Field label="Timezone (midnight cutoff)" name="timezone" defaultValue={c.timezone} />
              <Field label="Starts" name="starts_on" type="date" defaultValue={c.starts_on} />
              <Field label="Ends" name="ends_on" type="date" defaultValue={c.ends_on} />
              <Field label="Group workout minimum members" name="group_min_members" type="number" defaultValue={String(c.group_min_members)} />
              <Field label="Team points per group workout" name="group_team_bonus" type="number" defaultValue={String(c.group_team_bonus)} />
              <Field label="Penalty for fudging (points)" name="fudge_penalty" type="number" defaultValue={String(c.fudge_penalty)} />
              <div className="flex flex-col gap-1.5">
                <span className="label">Final score</span>
                <span className="flex min-h-[44px] items-center text-sm text-[#3F4652]">Team total ÷ number of members</span>
              </div>
            </div>
            <div>
              <SubmitButton className="btn-dark">Save settings</SubmitButton>
            </div>
          </ActionForm>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#FFD8A8] bg-[#FFF4E6] p-6">
            <h2 className="h2 text-xl">Flagged by moderators</h2>
            {flagged.length + flaggedGw.length === 0 && <p className="text-sm text-[#3F4652]">Nothing waiting.</p>}
            {flagged.map((f) => (
              <div key={f.id} className="flex flex-col gap-2 rounded-[10px] bg-white p-3.5">
                <div className="font-semibold">
                  {teamName.get(f.team_id)}, {nameOf.get(f.participant_id)}, {formatDay(f.entry_date)}
                </div>
                <div className="text-sm">
                  {f.activity_name}, {formatQuantity(f.unit, f.quantity)}
                </div>
                <div className="text-sm text-[#3F4652]">
                  Flagged by {f.reviewed_by ? nameOf.get(f.reviewed_by) : 'moderator'}: {f.review_note}
                </div>
                <ProofImage url={urls.get(f.proof_path)} alt="Flagged proof" height={140} />
                <ActionForm action={resolveFlag} className="flex flex-wrap gap-2">
                  <input type="hidden" name="entry_id" value={f.id} />
                  <SubmitButton name="decision" value="penalty" className="btn flex-1 bg-warn text-white" pendingText="…">
                    Apply −{c.fudge_penalty} to {teamName.get(f.team_id)}
                  </SubmitButton>
                  <SubmitButton name="decision" value="reject" className="btn-outline flex-1" pendingText="…">
                    Reject only
                  </SubmitButton>
                  <SubmitButton name="decision" value="dismiss" className="btn-outline flex-1" pendingText="…">
                    Dismiss flag
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>

          {flaggedGw.length > 0 && (
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#FFD8A8] bg-[#FFF4E6] p-6">
              <h2 className="h2 text-xl">Flagged group workouts</h2>
              {flaggedGw.map((g) => (
                <div key={g.id} className="flex flex-col gap-2 rounded-[10px] bg-white p-3.5">
                  <div className="font-semibold">
                    {teamName.get(g.team_id)}, {formatDay(g.workout_date)}
                  </div>
                  <div className="text-sm">
                    {g.description}, {g.participant_count} people
                  </div>
                  <div className="text-sm text-[#3F4652]">
                    Flagged by {g.reviewed_by ? nameOf.get(g.reviewed_by) : 'moderator'}: {g.review_note}
                  </div>
                  <ProofImage url={urls.get(g.proof_path)} alt="Flagged group workout photo" height={140} />
                  <ActionForm action={resolveGroupFlag} className="flex flex-wrap gap-2">
                    <input type="hidden" name="group_workout_id" value={g.id} />
                    <SubmitButton name="decision" value="penalty" className="btn flex-1 bg-warn text-white" pendingText="…">
                      Apply −{c.fudge_penalty} to {teamName.get(g.team_id)}
                    </SubmitButton>
                    <SubmitButton name="decision" value="reject" className="btn-outline flex-1" pendingText="…">
                      Reject only
                    </SubmitButton>
                    <SubmitButton name="decision" value="dismiss" className="btn-outline flex-1" pendingText="…">
                      Dismiss flag
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}

          <div className="card flex flex-col gap-3">
            <h2 className="h2 text-xl">Penalties</h2>
            {penalties.length === 0 && <p className="text-sm text-muted">No penalties so far.</p>}
            {penalties.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-t border-line pt-2.5">
                <div>
                  <div className="font-semibold">{teamName.get(p.team_id)}</div>
                  <div className="text-[13px] text-muted">
                    {p.reason}, {formatDay(p.created_at.slice(0, 10))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-bold text-bad">{String(p.points).replace('-', '−')}</span>
                  <ActionForm action={deletePenalty}>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton className="btn-outline btn-sm" pendingText="…">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                </div>
              </div>
            ))}
            <ActionForm action={addPenalty} className="flex flex-col gap-2 border-t border-line pt-3">
              <span className="label">Add a penalty</span>
              <label htmlFor="pen-team" className="sr-only">
                Team
              </label>
              <select id="pen-team" name="team_id" required className="input">
                {ctx.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label htmlFor="pen-reason" className="sr-only">
                Reason
              </label>
              <input id="pen-reason" name="reason" required placeholder="Reason" className="input" />
              <SubmitButton className="btn-dark">Apply −{c.fudge_penalty}</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, name, type = 'text', defaultValue }: { label: string; name: string; type?: string; defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue} required className="input" />
    </div>
  );
}
