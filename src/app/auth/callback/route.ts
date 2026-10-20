import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createAuthClient } from '@/lib/supabase/server';
import { linkParticipant } from '@/lib/link';

const OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

// Handles both kinds of sign-in link:
// - token_hash links (recommended email template): work in any browser on any device.
// - ?code= links (Supabase's default template, PKCE): only work in the browser that asked for the email,
//   because the code verifier is a cookie set at that moment.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type') as EmailOtpType | null;
  const type = rawType && OTP_TYPES.includes(rawType) ? rawType : 'email';
  const supabase = await createAuthClient();

  let error: { message: string } | null = null;
  if (tokenHash) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: url.searchParams.get('error_description') ?? 'No code or token in the link' };
  }

  if (error) {
    console.error('[auth/callback] sign-in link failed:', error.message);
    // A mail scanner may have opened the link first. If this browser is already signed in, carry on.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL('/login?error=link', url.origin));
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await linkParticipant(user.id, user.email);
  }
  return NextResponse.redirect(new URL('/', url.origin));
}
