import Link from 'next/link';

export function AdminTabs({ active, flagged }: { active: 'activities' | 'teams'; flagged: number }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} className={`mr-4 border-b-[3px] px-1 py-3 ${on ? 'border-accent font-semibold' : 'border-transparent text-muted hover:text-ink'}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap border-b border-[#DDE0D8]">
      {tab('/admin', flagged ? `Scoring & flags (${flagged})` : 'Scoring & flags', active === 'activities')}
      {tab('/admin/teams', 'Teams & members', active === 'teams')}
    </nav>
  );
}
