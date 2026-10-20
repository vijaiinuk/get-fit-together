'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-auto flex-wrap gap-1" aria-label="Main">
      {links.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-lg bg-[#2A303B] px-3.5 py-3 font-semibold text-white'
                : 'rounded-lg px-3.5 py-3 text-[#C9CED6] hover:text-white'
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
