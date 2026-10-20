import { Logo } from '@/components/Logo';

export default function NotOnList() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-ink px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
        <Logo />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-12">
        <h1 className="h1">You’re signed in, but not on the list</h1>
        <p className="text-muted">
          Your email isn’t linked to anyone in the current challenge. Ask the admin to add your email to your name, then
          sign in again.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn-dark">Sign out</button>
        </form>
      </div>
    </main>
  );
}
