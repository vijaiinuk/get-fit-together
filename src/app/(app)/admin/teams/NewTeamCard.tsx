'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';

type FormState = { error?: string; ok?: number };

// "Add team" tile that opens a short form only when needed.
export function NewTeamCard({ action }: { action: (prev: FormState, form: FormData) => Promise<FormState> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-edge bg-transparent p-6 font-semibold text-muted hover:border-ink hover:bg-white hover:text-ink"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        Add team
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="card flex flex-col gap-3 border-2 border-dashed border-edge"
    >
      <h2 className="h2">New team</h2>
      <label htmlFor="team-name" className="label">
        Team name
      </label>
      <input ref={input} id="team-name" name="name" required maxLength={40} placeholder="e.g. Team E" className="input" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input name="color" type="color" defaultValue="#0E7490" className="h-10 w-12 cursor-pointer rounded-lg border border-edge bg-white p-1" />
          Colour
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </button>
          <button className="btn-primary btn-sm" disabled={pending}>
            {pending ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </div>
      {state.error && (
        <p className="text-[13px] font-semibold text-warn" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
