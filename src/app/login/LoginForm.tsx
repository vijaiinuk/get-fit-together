'use client';

import { useActionState } from 'react';
import { sendMagicLink, verifyCode, type LoginState } from './actions';

export function LoginForm({ initialError }: { initialError?: string }) {
  const [sendState, send, sending] = useActionState<LoginState, FormData>(sendMagicLink, { error: initialError });
  const [codeState, verify, verifying] = useActionState<LoginState, FormData>(verifyCode, {});
  const email = sendState.sent;

  if (!email) {
    return (
      <form action={send} className="card flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        {sendState.error && (
          <p className="text-sm font-semibold text-warn" role="alert">
            {sendState.error}
          </p>
        )}
        <button className="btn-primary" disabled={sending}>
          {sending ? 'Sending…' : 'Email me a link'}
        </button>
      </form>
    );
  }

  return (
    <div className="card flex flex-col gap-4" role="status">
      <div className="flex flex-col gap-2">
        <h2 className="h2">Check your email</h2>
        <p>
          We sent a sign-in email to <span className="font-semibold">{email}</span>. Tap the link in it, or type the code
          below. The code works on any device and in the home-screen app.
        </p>
      </div>
      <form action={verify} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="label">
            Code from the email
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            className="input text-center font-display text-2xl tracking-[0.3em]"
          />
        </div>
        {codeState.error && (
          <p className="text-sm font-semibold text-warn" role="alert">
            {codeState.error}
          </p>
        )}
        <button className="btn-primary" disabled={verifying}>
          {verifying ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <form action={send}>
        <input type="hidden" name="email" value={email} />
        <button className="link text-sm" disabled={sending}>
          {sending ? 'Sending…' : 'Send a new email'}
        </button>
      </form>
    </div>
  );
}
