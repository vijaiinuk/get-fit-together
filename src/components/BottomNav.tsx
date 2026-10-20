'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  teams: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3 0 6 2 6 5',
  community: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  scorecard: 'M9 4h6v3H9zM6 6h12v15H6zM9 12l2 2 4-4',
  moderate: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  rules: 'M5 4h11l3 3v13H5zM9 10h6M9 14h6M9 18h3',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3.2 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

// Phone navigation: a thumb-reachable tab bar with the 4 most useful screens for this person's roles,
// and a "More" sheet for the rest plus sign out.
export function BottomNav({ primary, more, name, roles }: { primary: NavItem[]; more: NavItem[]; name: string; roles: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const moreActive = more.some((m) => isActive(path, m.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5">
            <div className="mb-3 px-2">
              <div className="font-semibold">{name}</div>
              <div className="text-[13px] text-muted">{roles}</div>
            </div>
            <ul className="flex flex-col">
              {more.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    aria-current={isActive(path, m.href) ? 'page' : undefined}
                    className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 font-semibold aria-[current=page]:text-accent"
                  >
                    <Icon name={m.icon} />
                    {m.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-line pt-2">
                <form action="/auth/signout" method="post">
                  <button className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 font-semibold text-muted">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                    </svg>
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((item) => {
            const active = isActive(path, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-accent' : 'text-muted'}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={`flex min-h-[60px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${open || moreActive ? 'text-accent' : 'text-muted'}`}
            >
              <Icon name="more" />
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
