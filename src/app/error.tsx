'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // In production, server error messages are replaced by a digest, so show something readable instead.
  const message = process.env.NODE_ENV === 'production' && error.digest ? 'Something went wrong on our side. Try again, and tell your admin if it keeps happening.' : error.message;
  return (
    <main className="page">
      <div className="card flex flex-col gap-3">
        <h1 className="h2">That didn’t work</h1>
        <p className="text-muted">{message || 'Something went wrong.'}</p>
        <div>
          <button className="btn-dark" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
