# StrongClub

A small workout app for your parents. You write the workouts; they open a link on
their phone, tap through one exercise at a time, and tick things off as they go.

- **Them:** pick their name → this week's workouts → tap one → big text, one
  exercise per screen, video or photo, timers for holds, checkmarks as they go.
- **You:** `/admin` behind a passcode → build weeks, add exercises with reps or
  time, attach a YouTube link or upload a clip you filmed → see what got done.

There's no login for your parents and no app store. They open the link, tap
**Share → Add to Home Screen**, and it behaves like an app.

## Running it locally

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

Then open http://localhost:3000. The admin passcode is `letmein` until you change
it in `.env.local`.

`npm run seed` writes a starter week (4 workouts, 16 chair-based exercises) into
`.data/db.json`. Re-running it wipes and rewrites that file.

## How data is stored

Two interchangeable stores sit behind the same interface in `src/lib/db/`:

| Store | When it's used | Where things go |
| --- | --- | --- |
| Local JSON | No Supabase env vars set | `.data/db.json`, uploads in `public/uploads/` |
| Supabase | Both Supabase env vars set | Postgres, uploads in the `workout-media` bucket |

Local is for development on your laptop. Supabase is what you deploy with —
serverless hosting has no persistent disk, so the JSON store won't survive there.

## Putting it online

### 1. Supabase (database + video storage)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor, paste in [`supabase/schema.sql`](supabase/schema.sql), run it.
   That creates the tables and the public `workout-media` bucket.
3. From **Project Settings → API**, copy the project URL and the **service role**
   key into `.env.local`.
4. Confirm it's all wired up:

   ```bash
   npm run check:supabase
   ```

   That checks every table and the storage bucket, and tells you what's missing.
   It prints the project URL but never the key.

5. Optionally put the starter week in the real database:

   ```bash
   npm run seed
   ```

   With Supabase configured, `seed` writes there instead of to the JSON file, and
   refuses to run if the project already has weeks (pass `--force` to override).

The service role key bypasses row-level security and is only ever used
server-side. Never put it in a `NEXT_PUBLIC_*` variable or ship it to the browser.

### 2. Vercel (hosting)

1. Push this folder to GitHub.
2. Import the repo at [vercel.com](https://vercel.com) — it detects Next.js on its own.
3. Add three environment variables:

   | Name | Value |
   | --- | --- |
   | `ADMIN_PASSCODE` | Something only you know |
   | `NEXT_PUBLIC_SUPABASE_URL` | From Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Supabase |

4. Deploy, then open `/admin` on the live URL and add your parents under **People**.

Send them the base URL — not the `/admin` one.

## A note on who can see what

The passcode protects `/admin`. The workout pages themselves are open to anyone
with the link: no accounts, no passwords, nothing for your parents to forget.
That's a deliberate trade for a family app. Anyone who has the URL can see the
workouts and tick boxes as Mum or Dad, so treat the link as semi-private and
don't put anything sensitive in the exercise notes.

## Adding a week

1. `/admin` → **Add week** → name it, set the start date.
2. Add workouts to it — four a week is the shape the copy assumes, but any number works.
3. Open each workout, add exercises. Per exercise you set:
   - reps, or a hold in seconds
   - sets and rest between them
   - instructions in your own words
   - a demo: paste a YouTube link, or upload a photo/video (up to 100 MB)
4. Tick **Visible to your parents** on the week when it's ready.

**Duplicate this week** on a week page copies everything — workouts, exercises,
media — as a fresh draft, which is the fast way to build next week from this one.

Whichever published week has the most recent start date is the one shown as
"this week"; the rest stay reachable under **Earlier weeks**.

## Layout

```
src/
  app/
    page.tsx              who's working out
    home/                 this week's workouts
    week/[weekId]/        any past week
    workout/[workoutId]/  overview, and /do for the player
    admin/                passcode-gated editor
    api/upload/           photo & video uploads
  components/
    WorkoutPlayer.tsx     one-exercise-at-a-time player, timers, rest screens
    WeekBoard.tsx         the four workout cards
    MediaFrame.tsx        YouTube / video / image rendering
  lib/
    db/                   local JSON and Supabase stores
    queries.ts            week and workout progress
    auth.ts               admin cookie, active-profile cookie
scripts/seed.mjs          starter data
supabase/schema.sql       run once in Supabase
```

## Checks

```bash
npm run lint && npx tsc --noEmit && npm run build
```
