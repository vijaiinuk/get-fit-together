import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Bottom padding on phones so the tab bar never covers the end of a page.
    <div className="min-h-screen pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
      <Header />
      {children}
    </div>
  );
}
