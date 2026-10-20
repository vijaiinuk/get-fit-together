'use client';

import { useContext } from 'react';
import { useFormStatus } from 'react-dom';
import { ActionPendingContext } from './ActionForm';

export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingText,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const actionPending = useContext(ActionPendingContext);
  const pending = actionPending ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value}>
      {pending ? pendingText ?? 'Saving…' : children}
    </button>
  );
}
