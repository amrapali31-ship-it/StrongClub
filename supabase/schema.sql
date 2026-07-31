-- StrongClub schema.
-- Paste this into the Supabase SQL editor and run it once.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#d6552b',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date,
  note text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks (id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts (id) on delete cascade,
  name text not null,
  instructions text not null default '',
  mode text not null default 'reps' check (mode in ('reps', 'time')),
  sets integer not null default 1,
  reps integer,
  duration_seconds integer,
  rest_seconds integer not null default 30,
  media_type text not null default 'none' check (media_type in ('none', 'youtube', 'video', 'image')),
  media_url text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists exercise_completions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  week_id uuid not null references weeks (id) on delete cascade,
  completed_at timestamptz not null default now(),
  -- Ticking the same exercise twice must not create a second row; the app
  -- relies on this constraint for its upsert.
  unique (profile_id, exercise_id)
);

create index if not exists workouts_week_idx on workouts (week_id, position);
create index if not exists exercises_workout_idx on exercises (workout_id, position);
create index if not exists completions_lookup_idx on exercise_completions (profile_id, week_id);

-- The app only ever reaches Postgres through the service role key on the
-- server, so no anon access is granted. RLS on with no policies = deny all.
alter table profiles enable row level security;
alter table weeks enable row level security;
alter table workouts enable row level security;
alter table exercises enable row level security;
alter table exercise_completions enable row level security;

-- Public bucket for exercise photos and clips.
insert into storage.buckets (id, name, public)
values ('workout-media', 'workout-media', true)
on conflict (id) do nothing;
