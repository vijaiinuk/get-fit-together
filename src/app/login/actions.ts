'use server';

import { redirect } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/server';
import { db } from '@/lib/supabase/admin';

export type LoginState = { sent?: string; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

// Step 1: email a sign-in link plus a one-time code.
// The link is the easy path on the same device. The code works everywhere else:
// a different browser, a phone's mail app, or the home-screen app (which has its own cookies).
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };

  // Only people on the challenge list get a link.
  const { data: match, error: lookupError } = await db()
    .from('participants')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error('[login] participant lookup failed', lookupError);
    return { error: 'Sign-in is unavailable right now. Tell your admin.' };
  }
  if (!match) return { error: 'That email isn’t on the challenge list yet. Ask your admin to add it.' };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error('[login] signInWithOtp failed', error.status, error.code, error.message);
    if (error.status === 429 || error.code === 'over_email_send_rate_limit' || /rate limit|security purposes/i.test(error.message)) {
      return { error: 'Too many emails sent. Wait a minute and try again, or use the code from your last email.' };
    }
    return { error: 'Could not send the email right now. Wait a minute and try again.' };
  }
  return { sent: email };
}

// Step 2 (optional): type the code from the email instead of clicking the link.
export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const token = String(form.get('code') ?? '').replace(/\s+/g, '');
  if (!EMAIL_RE.test(email)) return { error: 'Start again and enter your email.' };
  if (!/^\d{6,10}$/.test(token)) return { sent: email, error: 'Enter the code from the email (numbers only).' };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    console.error('[login] verifyOtp failed', error.status, error.code, error.message);
    return { sent: email, error: 'That code didn’t work. It may have expired, so ask for a new email.' };
  }
  redirect('/');
}
