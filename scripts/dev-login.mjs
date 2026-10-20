// Dev only: prints a one-time sign-in link for a participant without sending any email.
// Usage: node --env-file=.env.local scripts/dev-login.mjs someone@example.com
// Needs the service role key, so it can only be run by someone who already has full access.
import { createClient } from '@supabase/supabase-js';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/dev-login.mjs someone@example.com');
  process.exit(1);
}
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: p } = await db.from('participants').select('display_name').eq('email', email).limit(1).maybeSingle();
if (!p) {
  console.error(`${email} isn't on the challenge list. Add it in Admin > Teams & members first.`);
  process.exit(1);
}

let { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
if (error && /not found|no user/i.test(error.message)) {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  ({ data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email }));
}
if (error) throw error;

console.log(`Sign-in link for ${p.display_name} (open it in a private window to stay signed in as yourself elsewhere):`);
console.log(`${site}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
