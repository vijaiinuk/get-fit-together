import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

const ERRORS: Record<string, string> = {
  link: 'That sign-in link didn’t work. Links expire after an hour and only work once. Enter your email for a new one, or use the code from the email.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-ink px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
        <Logo />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
        <div>
          <h1 className="h1">Sign in</h1>
          <p className="mt-2 text-muted">We’ll email you a link and a code. No password needed.</p>
        </div>
        <LoginForm initialError={error ? ERRORS[error] ?? ERRORS.link : undefined} />
      </div>
    </main>
  );
}
