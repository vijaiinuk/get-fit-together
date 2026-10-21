import { getContext } from '@/lib/context';
import { tint } from '@/components/Avatar';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { AvatarUploader } from './AvatarUploader';
import { saveAlias } from './actions';

export default async function ProfilePage() {
  const ctx = await getContext();
  const { me, myTeam } = ctx;
  const fullName = me.full_name ?? me.display_name;
  const roles = [
    ctx.captainOf ? `Captain of ${ctx.captainOf.name}` : myTeam ? `Member of ${myTeam.name}` : 'Not on a team yet',
    ctx.moderates.length ? `Moderator of ${ctx.moderates.map((t) => t.name).join(', ')}` : null,
    ctx.isAdmin ? 'Admin' : null,
  ].filter(Boolean);

  return (
    <main className="page max-w-[720px]">
      <section>
        <div className="kicker">{ctx.challenge.name}</div>
        <h1 className="h1 mt-1.5">Your profile</h1>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="h2">Profile picture</h2>
        <AvatarUploader name={me.display_name} color={myTeam ? tint(myTeam.color) : '#E7E9E3'} src={me.avatar_url ?? null} />
      </section>

      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="h2">Display name</h2>
          <p className="mt-1 text-sm text-muted">
            What everyone sees on scorecards, standings and posts. Leave it empty to use your name on the list,{' '}
            <span className="font-semibold text-ink">{fullName}</span>.
          </p>
        </div>
        <ActionForm action={saveAlias} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-[1_1_220px] flex-col gap-1.5">
            <label htmlFor="alias" className="label">
              Alias
            </label>
            <input id="alias" name="alias" defaultValue={me.alias ?? ''} maxLength={30} placeholder={fullName} autoComplete="nickname" className="input" />
          </div>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2">Your details</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-muted">Name on the list</dt>
            <dd className="font-semibold">{fullName}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">Sign-in email</dt>
            <dd className="break-all font-semibold">{me.email ?? ctx.email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[13px] text-muted">Roles</dt>
            <dd className="font-semibold">{roles.join(' · ')}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] text-muted">To change your name on the list, email or team, ask an admin.</p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="btn-outline btn-sm">Sign out</button>
        </form>
      </section>
    </main>
  );
}
