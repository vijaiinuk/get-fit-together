'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase/admin';
import { getContext } from '@/lib/context';

// Called when the notifications page opens. Clears the unread badge in the header.
export async function markNotificationsSeen() {
  const ctx = await getContext();
  const { error } = await db()
    .from('participants')
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq('id', ctx.me.id);
  if (error) console.error('[notifications] mark seen failed', error);
  revalidatePath('/', 'layout');
}
