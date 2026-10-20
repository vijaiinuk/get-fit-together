import Link from 'next/link';
import { getContext } from '@/lib/context';
import { Logo } from './Logo';
import { NavLinks } from './NavLinks';

export async function Header() {
  const ctx = await getContext();
  const links = [
    { href: '/', label: 'Home' },
    { href: '/teams', label: 'Teams' },
    { href: '/community', label: 'Community' },
    ...(ctx.captainOf ? [{ href: '/scorecard', label: 'Scorecard' }] : []),
    ...(ctx.moderates.length ? [{ href: '/moderate', label: 'Moderate' }] : []),
    { href: '/rules', label: 'Rules' },
    ...(ctx.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];
  const roles = [
    ctx.captainOf ? `Captain · ${ctx.captainOf.name}` : ctx.myTeam ? `Member · ${ctx.myTeam.name}` : 'Not on a team yet',
    ctx.isAdmin ? 'Admin' : null,
  ].filter(Boolean);

  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="FitLeague home">
          <Logo />
        </Link>
        <NavLinks links={links} />
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="font-semibold">{ctx.me.display_name}</div>
            <div className="text-xs text-[#C9CED6]">{roles.join(' · ')}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-2 text-sm text-[#C9CED6] hover:bg-[#2A303B] hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
