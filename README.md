# StrongClub

A small workout app for your parents. You write the workouts; they open a link on
their phone, read the week, and follow along at their own pace.

- **Them:** pick their name → this week's workouts → tap one → the whole workout
  on one page: big text, video or photo per exercise, an optional timer on holds,
  and a tick beside anything they've done. Nothing to start, nothing to drive.
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

1. `/admin` → **Repeat last week** (copies everything across) or **Start Week N
   empty**. Either way it names and dates itself; rename it if you care.
2. Add workouts to it — four a week is the shape the copy assumes, but any number works.
3. Open each workout, add exercises. Per exercise you set:
   - reps, or a hold in seconds
   - sets and rest between them
   - instructions in your own words
   - a demo: paste a YouTube link, or upload a photo/video (up to 100 MB)
4. Tick **Visible to your parents** on the week when it's ready.

**Repeat last week** on the admin home is the usual weekly path: it clones the
previous week's workouts, exercises and videos into the next dated slot as a
draft, ready to tweak.

## Exercise library

`/admin/library` holds your reusable movements, grouped by category. When you
build a workout you pick from this list instead of retyping, and the exercise is
**copied** into that workout — sets, reps, rest, instructions and video.

Copy rather than reference is deliberate: adjusting reps for one week never
rewrites a week your parents already finished, and editing a library entry never
changes history.

The payoff is media. Attach a YouTube link to "Squat" once here, and every future
workout built from it arrives with the video already on it.

```bash
npm run seed:library
```

Adds ~70 standard movements — squats, deadlifts, lunges, presses, rows, planks,
balance work, stretches, cardio — which you can then edit or delete. Safe to
re-run and safe on a live database: it only adds names that aren't already
there, so your own edits are never touched.

Two other routes into the library: **Save to library** at the bottom of any
workout exercise pushes it back for reuse (saving under a name that already
exists updates that entry rather than making a near-duplicate), and you can add
entries by hand at the top of the library page.

## Sub-sections inside a workout

Exercises carry the category they inherited from the library, and the workout
page groups by it — Legs, then Core, then Balance. No extra step: pick from the
library and the sections appear.

Reorder by dragging the ⠿ handle. Drag only starts from the handle so the list
still scrolls normally under a thumb; on touch it needs a brief press-and-hold
for the same reason. Dropping an exercise under a different heading moves it
into that section.

**Warm-up** always opens a workout and **Cool-down** always closes it, whatever
order you added them in. Everything between follows the order you arranged the
exercises. Reorder arrows move an exercise **within** its own section — crossing
a boundary would silently recategorise it.

Headings only show when a workout has more than one section; a "Legs" header
above four leg exercises is noise. One-offs you typed in with no section collect
at the end under "Also", and you can set a section on any exercise from its own
edit page.

Exercises created before this existed need one backfill:

```bash
npm run backfill:categories
```

It matches names against the library and only fills blanks — anything you've set
by hand is left alone.

## Importing a week with AI

`/admin/import` takes a pasted plan, photos, or both, and drafts a whole week —
workouts, exercises, reps, sets, rest, instructions. You review it, then it saves
as an unpublished draft you can edit like any other week.

Set `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com),
separate from any Claude subscription) to switch it on. Without it the page says
so and the rest of the app is unaffected.

Images work for the sources you can't copy and paste: a physio's printed handout,
a screenshot of another app, a photo of a routine someone wrote down. Up to 6
images, 5 MB each.

**Videos are deliberately never imported.** Models generate YouTube IDs that look
plausible and resolve to nothing or to the wrong clip, so media stays a manual
step. Everything else — names, numbers, instructions — is transcribed from what
you supplied, and the prompt tells the model to leave gaps empty rather than
invent technique cues for exercises it can't read.

Roughly a fraction of a penny per import. The review step is not decorative:
this is exercise guidance for your parents, so read the numbers before publishing.

Weeks are labelled by when they are, not what they're called: **Last week**,
**This week**, **Next week**, with back/forward links between them. Anything
further out falls back to "Week of 6 July", since "3 weeks ago" is harder to
place than a date. The week's own title sits underneath as supporting detail —
which is why not naming them costs you nothing.

## Layout

```
src/
  app/
    page.tsx              who's working out
    home/                 this week's workouts
    week/[weekId]/        any past week
    workout/[workoutId]/  the workout itself — read top to bottom
    admin/                passcode-gated editor
    api/upload/           photo & video uploads
  components/
    ExerciseMedia.tsx     inline video/photo; YouTube loads only when tapped
    InlineTimer.tsx       optional countdown on timed holds
    WeekBoard.tsx         the four workout cards
    MediaFrame.tsx        YouTube / video / image rendering
  lib/
    db/                   local JSON and Supabase stores
    queries.ts            week and workout progress
    auth.ts               admin cookie, active-profile cookie
scripts/seed.mjs          starter data
supabase/schema.sql       run once in Supabase
```

## Look and feel

Dark, contrast-first. The palette lives in `@theme` at the top of
`src/app/globals.css` — change the tokens there and the whole app follows.

The one rule worth keeping: what makes an interface hard for older eyes is low
contrast, not darkness. Every pairing here clears WCAG AA by a wide margin
(lowest is 5.6:1 against a 4.5:1 requirement), and CTAs put dark text on bright
pink rather than white-on-pink, which would have been the weakest pairing on the
page. Hover goes *brighter*, not darker — darker reads as disabled on a dark UI.

## Changing the logo

The mark is one file: [`src/app/icon.svg`](src/app/icon.svg). Edit it — or drop
in any square SVG — then regenerate the raster sizes:

```bash
npm run icons
```

That writes `src/app/apple-icon.png` (iOS home screen, which ignores SVG) and
`public/icon-192.png` / `icon-512.png` (referenced by the web manifest). Next
links the SVG for the browser tab automatically from its filename.

Check it at 32px before committing — a mark that reads well large can turn to
mush in a tab.

## Checks

```bash
npm run lint && npx tsc --noEmit && npm run build
```
