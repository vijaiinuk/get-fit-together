'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';

type FormState = { error?: string; ok?: number };

// Team name shown in full, with a pencil button that opens a small edit form (name + colour).
export function TeamNameEditor({
  team,
  members,
  action,
  deleteAction,
}: {
  team: { id: string; name: string; color: string };
  members: number;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  deleteAction: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  const [delState, delAction, deleting] = useActionState(deleteAction, {});
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border-2 border-bad bg-badbg p-3" role="alertdialog" aria-labelledby={`del-${team.id}`}>
        <p id={`del-${team.id}`} className="font-semibold text-bad">
          Delete {team.name}?
        </p>
        <p className="text-[13px] text-ink">
          This can’t be undone. Only teams with no members and no entries, group workouts, penalties or team news can be
          deleted.
        </p>
        {delState.error && (
          <p className="text-[13px] font-semibold text-bad" role="alert">
            {delState.error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setConfirming(false)} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm bg-bad text-white hover:bg-[#6B1414]"
            disabled={deleting}
            onClick={() => {
              const data = new FormData();
              data.set('team_id', team.id);
              startTransition(() => delAction(data));
            }}
          >
            {deleting ? 'Deleting…' : 'Delete team'}
          </button>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="h2 min-w-0 break-words">{team.name}</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${team.name}’s name and colour`}
              title="Edit name and colour"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted hover:bg-ground hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${team.name}`}
              title="Delete team"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-bad hover:bg-badbg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
          <div className="mt-0.5 text-[13px] text-muted">{members} members</div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-2.5 rounded-xl bg-ground p-3"
    >
      <input type="hidden" name="team_id" value={team.id} />
      <label htmlFor={`name-${team.id}`} className="label">
        Team name
      </label>
      <input
        ref={input}
        id={`name-${team.id}`}
        name="name"
        defaultValue={team.name}
        required
        maxLength={40}
        className="input font-semibold"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input
            name="color"
            type="color"
            defaultValue={team.color}
            className="h-10 w-12 cursor-pointer rounded-lg border border-edge bg-white p-1"
          />
          Colour
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </button>
          <button className="btn-dark btn-sm" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
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
