import Link from 'next/link';
import { getContext } from '@/lib/context';
import { db } from '@/lib/supabase/admin';
import { Logo } from './Logo';
import { NavLinks } from './NavLinks';
import { BottomNav, type NavItem } from './BottomNav';
import { Avatar, tint } from './Avatar';

export async function Header() {
  const ctx = await getContext();
  // Unread notifications for the bell badge (one small query). 0 if migration 0004 hasn't run.
  const { data: unreadData } = await db().rpc('member_unread_count', { p_participant: ctx.me.id });
  const unread = typeof unreadData === 'number' ? unreadData : 0;
  const all: NavItem[] = [
    { href: '/', label: 'Home', icon: 'home' },
    ...(ctx.captainOf ? [{ href: '/scorecard', label: 'Scorecard', icon: 'scorecard' } as NavItem] : []),
    ...(ctx.moderates.length ? [{ href: '/moderate', label: 'Moderate', icon: 'moderate' } as NavItem] : []),
    { href: '/teams', label: 'Teams', icon: 'teams' },
    { href: '/community', label: 'Community', icon: 'community' },
  ];
  const extra: NavItem[] = [
    { href: '/profile', label: 'Profile', icon: 'profile' },
    { href: '/rules', label: 'Rules', icon: 'rules' },
    ...(ctx.isAdmin ? [{ href: '/admin', label: 'Admin', icon: 'admin' } as NavItem] : []),
  ];
  // Phones: the first four go in the tab bar, everything else in "More".
  const primary = all.slice(0, 4);
  const more = [...all.slice(4), ...extra];

  const roles = [
    ctx.captainOf ? `Captain · ${ctx.captainOf.name}` : ctx.myTeam ? `Member · ${ctx.myTeam.name}` : 'Not on a team yet',
    ctx.moderates.length ? `Moderator · ${ctx.moderates.map((t) => t.name).join(', ')}` : null,
    ctx.isAdmin ? 'Admin' : null,
  ].filter(Boolean).join(' · ');

  // Desktop order keeps the familiar layout.
  const desktop = [
    { href: '/', label: 'Home' },
    { href: '/teams', label: 'Teams' },
    { href: '/community', label: 'Community' },
    ...(ctx.captainOf ? [{ href: '/scorecard', label: 'Scorecard' }] : []),
    ...(ctx.moderates.length ? [{ href: '/moderate', label: 'Moderate' }] : []),
    { href: '/rules', label: 'Rules' },
    ...(ctx.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-ink pt-[env(safe-area-inset-top)] text-white md:static">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-6 md:flex-wrap md:py-3.5">
          <Link href="/" aria-label="FitLeague home">
            <Logo />
          </Link>
          <div className="hidden flex-auto md:flex">
            <NavLinks links={desktop} />
          </div>
          <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
            <Link
              href="/notifications"
              aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
              className="relative flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[#C9CED6] hover:bg-[#2A303B] hover:text-white"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" aria-label="Your profile" className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 hover:bg-[#2A303B] md:px-2">
              <div className="min-w-0 text-right leading-tight">
                <div className="truncate font-semibold">{ctx.me.display_name}</div>
                <div className="truncate text-xs text-[#C9CED6]">{roles}</div>
              </div>
              <Avatar name={ctx.me.display_name} src={ctx.me.avatar_url} color={ctx.myTeam ? tint(ctx.myTeam.color) : undefined} size={36} />
            </Link>
            <form action="/auth/signout" method="post" className="hidden md:block">
              <button className="rounded-lg px-3 py-2 text-sm text-[#C9CED6] hover:bg-[#2A303B] hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <BottomNav primary={primary} more={more} name={ctx.me.display_name} roles={roles} />
    </>
  );
}
