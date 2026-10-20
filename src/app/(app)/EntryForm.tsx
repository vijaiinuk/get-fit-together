'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { ProofUploader } from '@/components/ProofUploader';
import { submitEntry, type EntryFormState } from './actions';
import type { ActivityType } from '@/lib/types';

export function EntryForm({
  types,
  participantId,
  defaults,
  compact = false,
  onDone,
}: {
  types: ActivityType[];
  participantId?: string;
  defaults?: { activityTypeId: string; quantity: number };
  compact?: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<EntryFormState, FormData>(submitEntry, {});
  const [typeId, setTypeId] = useState(defaults?.activityTypeId ?? '');
  const [qty, setQty] = useState(defaults ? String(defaults.quantity) : '');
  const [formKey, setFormKey] = useState(0);
  const type = types.find((t) => t.id === typeId);
  const n = Number(qty) || 0;

  useEffect(() => {
    if (state.ok) {
      setFormKey((k) => k + 1);
      onDone?.();
    }
  }, [state, onDone]);

  let hint = 'Pick an activity to start';
  let hintClass = 'text-muted';
  if (type && n < type.threshold) {
    hint = `Needs ${type.unit === 'steps' ? type.threshold.toLocaleString('en-GB') + ' steps' : type.threshold + ' minutes'} to earn a point`;
    hintClass = 'text-warn';
  } else if (type) {
    hint = 'This earns 1 point once verified';
    hintClass = 'text-ok';
  }

  return (
    <form
      key={formKey}
      // onSubmit rather than action={...}: React 19 resets a form after every action, which would
      // throw away the uploaded proof when the server returns a validation error.
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      {participantId && <input type="hidden" name="participant_id" value={participantId} />}
      <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`type-${participantId ?? 'me'}`} className="label">
            What did you do?
          </label>
          <select
            id={`type-${participantId ?? 'me'}`}
            name="activity_type_id"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            required
            className="input min-h-[48px]"
          >
            <option value="">Choose…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`qty-${participantId ?? 'me'}`} className="label">
            {type?.unit === 'steps' ? 'Steps' : 'Minutes'}
          </label>
          <input
            id={`qty-${participantId ?? 'me'}`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={type?.unit === 'steps' ? '8000' : '40'}
            required
            className="input min-h-[48px]"
          />
        </div>
      </div>
      <ProofUploader compact={compact} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`text-sm font-semibold ${hintClass}`}>{hint}</span>
        <button className="btn-primary min-h-[48px] px-7" disabled={pending}>
          {pending ? 'Saving…' : 'Upload proof'}
        </button>
      </div>
      {state.error && (
        <p className="text-sm font-semibold text-warn" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
