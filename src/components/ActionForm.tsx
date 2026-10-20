'use client';

import { createContext, startTransition, useActionState, useEffect, useRef } from 'react';

type FormState = { error?: string; ok?: number };

// Lets SubmitButton show "Saving…" for forms that submit through ActionForm.
export const ActionPendingContext = createContext<boolean | null>(null);

// A <form> for server actions wrapped with safe(): shows the action's error message under the form.
//
// It submits through onSubmit instead of <form action>, because React 19 resets a form after
// every action, even one that returned a validation error, which wipes what the person typed
// (e.g. the group workout description and who took part). Here the form is only reset on success.
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    // Include the clicked button's name/value (e.g. decision=verified).
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  return (
    <ActionPendingContext.Provider value={pending}>
      <form ref={formRef} onSubmit={onSubmit} className={className}>
        {children}
        {state.error && (
          <p className="col-span-full basis-full text-[13px] font-semibold text-warn" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </ActionPendingContext.Provider>
  );
}
