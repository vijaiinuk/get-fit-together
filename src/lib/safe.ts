import 'server-only';
import { unstable_rethrow } from 'next/navigation';

export type FormState = { error?: string; ok?: number };

// Wraps a form server action so validation errors come back as data instead of being thrown.
// In production Next.js hides the message of any error thrown from a server action, so people
// would only see a generic "something went wrong" page instead of e.g. "Add a short note".
export function safe(fn: (form: FormData) => Promise<unknown>) {
  return async (_prev: FormState, form: FormData): Promise<FormState> => {
    try {
      await fn(form);
      return { ok: Date.now() };
    } catch (e) {
      unstable_rethrow(e); // let redirect() and notFound() through
      console.error('[action]', e);
      return { error: e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.' };
    }
  };
}

// Awaits a Supabase query and throws a readable error if it failed, instead of carrying on
// as if the write worked. Use for every insert/update/delete in server actions.
export async function must<T extends { error: { message: string } | null }>(
  query: PromiseLike<T>,
  message = 'Could not save that. Try again.',
): Promise<T> {
  const result = await query;
  if (result.error) {
    console.error('[db]', result.error);
    throw new Error(message);
  }
  return result;
}
