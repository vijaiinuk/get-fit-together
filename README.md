# FitLeague: Bodhi & Hridhi Hustle

A small team fitness challenge app for family and friends. Members upload daily workout proof, captains submit their team's scorecard, a captain from another team verifies it, and admins handle flags and penalties. Teams are ranked by average points per member.

Built with Next.js (App Router, server actions) and Supabase (Postgres, email sign-in, file storage). It fits within the free tiers of Supabase and Vercel for a group of about 50.

## How it works

| Role | Can do |
| --- | --- |
| Member | Upload today's workout with a screenshot or photo, see all teams and standings, post and comment |
| Captain | Everything a member can, plus log or correct entries for teammates, add group workouts, submit the daily scorecard, broadcast to their team |
| Moderator | Verify, reject or flag entries on the team they moderate (always a captain from another team) |
| Admin | Activity types and scoring settings, teams, captains, moderators, members' emails, decide on flags, apply or remove penalties, hide posts |

Scoring rules, as built:

- 1 point when an entry meets its threshold (40 min of gym, sport, yoga or brisk walk, or 8,000 steps) and a moderator verifies it.
- One entry per person per day, so the maximum is 1 point per person per day.
- A verified group workout with 3 or more teammates gives the team 1 bonus point. Each participant logs their own entry for their individual point.
- Entries can only be made for today in the challenge timezone, so the midnight deadline is automatic.
- Penalties are −5 per case, applied by an admin.
- Final score = (individual points + group bonus + penalties) ÷ number of team members.

All of the numbers above can be changed in Admin.

## Setup

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (free plan). Pick the region closest to most participants.
2. Open **SQL Editor**, paste in `supabase/migrations/0001_schema.sql` and run it, then do the same with `0002_group_workout_flags.sql`, `0003_profiles.sql` and `0004_notifications.sql`, in that order.
3. Open `supabase/seed.sql` and change three things at the top:
   - `admin_email`: your email, in lower case
   - the challenge `starts_on` and `ends_on` dates
   - the `timezone`, which decides when "midnight" is (for example `Europe/London` or `Asia/Kolkata`)
4. Paste the edited seed into the SQL Editor and run it. This creates the four teams, all 45 members, the captains and the moderator rotation.

### 2. Configure sign-in

In Supabase, go to **Authentication > URL Configuration**:

- **Site URL**: your app's URL (use `http://localhost:3000` while testing locally)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`

Then go to **Authentication > Emails > Templates** and replace the body of both **Magic Link** and **Confirm signup** with the matching file in `supabase/email-templates/`. (New people get the "Confirm signup" email the first time they sign in, so both need changing.) The new templates send:

- a link that works in any browser, because it uses `token_hash` and doesn't need a cookie from the browser that asked for it. Supabase's default `?code=` link only works in that same browser, so it fails when someone requests it on a laptop and opens it on their phone, or when a phone's mail app opens it in its own browser.
- a one-time code people can type on the sign-in screen. Use this for the home-screen app: on iPhone, the home-screen app keeps its own cookies, so a link opened in Safari never signs it in.

Supabase's built-in email sender is only meant for testing and has a low hourly limit (a few emails an hour). Before inviting everyone, set up a free SMTP provider (for example Resend or Brevo) under **Authentication > Emails > SMTP Settings**. People only sign in once per device, so volume stays low after the first day.

### 3. Run it locally

```bash
cp .env.example .env.local   # then fill in the values from Supabase > Project Settings > API
npm install
npm run dev
```

Open http://localhost:3000, enter your admin email, then click the link or type the code from the email.

To test as other people without sending emails (Supabase's built-in sender allows only a couple an hour), print a sign-in link instead:

```bash
node --env-file=.env.local scripts/dev-login.mjs someone@example.com
```

### 4. Add everyone's emails

Go to **Admin > Teams & members** and fill in each person's email. Someone can sign in as soon as their email is saved. The "Signed in" column shows who has logged in at least once.

### 5. Deploy

1. Push this folder to a GitHub repository.
2. Import it in [Vercel](https://vercel.com) (Hobby plan).
3. Add the four environment variables from `.env.example`, with `NEXT_PUBLIC_SITE_URL` set to your Vercel URL.
4. Add the Vercel callback URL to Supabase's Redirect URLs (step 2).

Share the link with the group. On phones, "Add to Home Screen" gives an app-like icon.

## Notes

**Security.** The browser never reads the database directly. Every page and action runs on the server, checks the signed-in user's role, then uses the service role key. Row level security is switched on with no policies, so the public anon key can't read or change any table. Proof images live in a private bucket and are shown through short-lived signed links.

**Storage.** Images are resized to 1280px and compressed in the browser before upload (usually 150 to 300 KB), so a month of daily proofs for 45 people stays within the free storage allowance.

**Changing teams mid-challenge.** Points stay with the team the person was on when they logged the entry.

**Free plan pausing.** Supabase pauses free projects after a week with no activity. Resume it from the dashboard before the next challenge.

## Project layout

```
supabase/
  migrations/0001_schema.sql   tables, scoring views, storage bucket
  seed.sql                     Bodhi & Hridhi Hustle teams and members
  email-templates/             sign-in emails (link + code) to paste into Supabase
src/
  middleware.ts                session refresh, sign-in redirect
  lib/                         context (who am I, what roles), data helpers, dates, proof uploads
  components/                  header, proof uploader, pills, buttons
  app/
    login/, auth/              email link sign-in
    (app)/page.tsx             member home: today's upload, my challenge, standings
    (app)/teams/               all teams, members, recent activity
    (app)/community/           posts, comments, likes, captain broadcasts
    (app)/scorecard/           captain's daily scorecard
    (app)/moderate/            moderator verification
    (app)/admin/               scoring, flags, penalties, teams and members
    (app)/rules/               rules generated from the settings
```
