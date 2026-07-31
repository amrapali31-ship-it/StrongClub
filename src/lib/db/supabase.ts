import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database, Exercise, LibraryExercise, Profile, Week, Workout } from '@/lib/types';

let cached: SupabaseClient | null = null;

/**
 * Server-only client using the service role key. Every call in this file runs
 * inside a server component or server action, never in the browser, so it is
 * safe to bypass row-level security here.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or unset both to use the local JSON store.',
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

export const supabaseDb: Database = {
  async listProfiles() {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('profiles').select('*').order('position'));
  },

  async getProfile(id) {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Profile) ?? null;
  },

  async createProfile(data) {
    const sb = supabaseAdmin();
    const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    return unwrap(
      await sb
        .from('profiles')
        .insert({ ...data, position: count ?? 0 })
        .select()
        .single(),
    );
  },

  async updateProfile(id, patch) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('profiles').update(patch).eq('id', id).select().single());
  },

  async deleteProfile(id) {
    const sb = supabaseAdmin();
    const { error } = await sb.from('profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listWeeks(opts) {
    const sb = supabaseAdmin();
    let q = sb
      .from('weeks')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (opts?.publishedOnly) q = q.eq('published', true);
    return unwrap(await q);
  },

  async getWeek(id) {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('weeks').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Week) ?? null;
  },

  async createWeek(data) {
    const sb = supabaseAdmin();
    return unwrap(
      await sb
        .from('weeks')
        .insert({
          title: data.title,
          start_date: data.start_date ?? null,
          note: data.note ?? '',
          published: data.published ?? false,
        })
        .select()
        .single(),
    );
  },

  async updateWeek(id, patch) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('weeks').update(patch).eq('id', id).select().single());
  },

  async deleteWeek(id) {
    const sb = supabaseAdmin();
    const { error } = await sb.from('weeks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listWorkouts(weekId) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('workouts').select('*').eq('week_id', weekId).order('position'));
  },

  async getWorkout(id) {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('workouts').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Workout) ?? null;
  },

  async createWorkout(data) {
    const sb = supabaseAdmin();
    const { count } = await sb
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('week_id', data.week_id);
    return unwrap(
      await sb
        .from('workouts')
        .insert({
          week_id: data.week_id,
          title: data.title,
          subtitle: data.subtitle ?? '',
          position: data.position ?? count ?? 0,
        })
        .select()
        .single(),
    );
  },

  async updateWorkout(id, patch) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('workouts').update(patch).eq('id', id).select().single());
  },

  async deleteWorkout(id) {
    const sb = supabaseAdmin();
    const { error } = await sb.from('workouts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listExercises(workoutId) {
    const sb = supabaseAdmin();
    return unwrap(
      await sb.from('exercises').select('*').eq('workout_id', workoutId).order('position'),
    );
  },

  async getExercise(id) {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('exercises').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Exercise) ?? null;
  },

  async createExercise(data) {
    const sb = supabaseAdmin();
    const { count } = await sb
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('workout_id', data.workout_id);
    return unwrap(
      await sb
        .from('exercises')
        .insert({
          workout_id: data.workout_id,
          name: data.name,
          instructions: data.instructions ?? '',
          mode: data.mode ?? 'reps',
          sets: data.sets ?? 1,
          reps: data.reps ?? null,
          duration_seconds: data.duration_seconds ?? null,
          rest_seconds: data.rest_seconds ?? 30,
          media_type: data.media_type ?? 'none',
          media_url: data.media_url ?? '',
          position: data.position ?? count ?? 0,
        })
        .select()
        .single(),
    );
  },

  async updateExercise(id, patch) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('exercises').update(patch).eq('id', id).select().single());
  },

  async deleteExercise(id) {
    const sb = supabaseAdmin();
    const { error } = await sb.from('exercises').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listLibrary() {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('library_exercises').select('*').order('name'));
  },

  async getLibraryExercise(id) {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('library_exercises')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LibraryExercise) ?? null;
  },

  async createLibraryExercise(data) {
    const sb = supabaseAdmin();
    return unwrap(
      await sb
        .from('library_exercises')
        .insert({
          name: data.name,
          category: data.category,
          instructions: data.instructions ?? '',
          mode: data.mode ?? 'reps',
          sets: data.sets ?? 2,
          reps: data.reps ?? 10,
          duration_seconds: data.duration_seconds ?? null,
          rest_seconds: data.rest_seconds ?? 30,
          media_type: data.media_type ?? 'none',
          media_url: data.media_url ?? '',
        })
        .select()
        .single(),
    );
  },

  async updateLibraryExercise(id, patch) {
    const sb = supabaseAdmin();
    return unwrap(await sb.from('library_exercises').update(patch).eq('id', id).select().single());
  },

  async deleteLibraryExercise(id) {
    const sb = supabaseAdmin();
    const { error } = await sb.from('library_exercises').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listCompletions(filter) {
    const sb = supabaseAdmin();
    let q = sb.from('exercise_completions').select('*');
    if (filter?.profileId) q = q.eq('profile_id', filter.profileId);
    if (filter?.weekId) q = q.eq('week_id', filter.weekId);
    if (filter?.workoutId) q = q.eq('workout_id', filter.workoutId);
    return unwrap(await q);
  },

  async setExerciseDone(profileId, exerciseId, done) {
    const sb = supabaseAdmin();

    if (!done) {
      const { error } = await sb
        .from('exercise_completions')
        .delete()
        .eq('profile_id', profileId)
        .eq('exercise_id', exerciseId);
      if (error) throw new Error(error.message);
      return;
    }

    const exercise = unwrap(
      await sb.from('exercises').select('workout_id').eq('id', exerciseId).single(),
    ) as { workout_id: string };
    const workout = unwrap(
      await sb.from('workouts').select('id, week_id').eq('id', exercise.workout_id).single(),
    ) as { id: string; week_id: string };

    const { error } = await sb.from('exercise_completions').upsert(
      {
        profile_id: profileId,
        exercise_id: exerciseId,
        workout_id: workout.id,
        week_id: workout.week_id,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,exercise_id' },
    );
    if (error) throw new Error(error.message);
  },

  async resetWorkout(profileId, workoutId) {
    const sb = supabaseAdmin();
    const { error } = await sb
      .from('exercise_completions')
      .delete()
      .eq('profile_id', profileId)
      .eq('workout_id', workoutId);
    if (error) throw new Error(error.message);
  },
};
