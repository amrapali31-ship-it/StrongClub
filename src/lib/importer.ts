import Anthropic from '@anthropic-ai/sdk';

import { suggestMatch } from '@/lib/matching';
import type { ExerciseMode } from '@/lib/types';

export interface DraftExercise {
  name: string;
  /**
   * The library entry this is the same movement as, chosen by name from what's
   * actually in the library. Empty when nothing there fits.
   */
  library_match: string;
  /** Resolved from `library_match` before the draft ever reaches the browser. */
  library_id?: string;
  library_name?: string;
  /**
   * True when the pairing came from comparing names afterwards rather than
   * from the model. Offered unticked, because it's a guess.
   */
  library_suggested?: boolean;
  /** Section heading, e.g. "Warm-up" or "Legs". Empty when the source has none. */
  category: string;
  equipment: string;
  instructions: string;
  mode: ExerciseMode;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
}

export interface DraftWorkout {
  title: string;
  subtitle: string;
  exercises: DraftExercise[];
}

export interface DraftWeek {
  title: string;
  note: string;
  workouts: DraftWorkout[];
}

/** Images Claude can read. Anything else is rejected before the API call. */
export const IMPORT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export const MAX_IMPORT_IMAGES = 6;
export const MAX_IMPORT_IMAGE_BYTES = 5 * 1024 * 1024;

const nullableInteger = { anyOf: [{ type: 'integer' }, { type: 'null' }] };

export interface LibraryChoice {
  id: string;
  name: string;
}

/**
 * The exercise shape, built around whatever is in the library right now.
 *
 * `library_match` is an enum of real entry names rather than free text, so the
 * model can only ever name something that exists — a match that has to be
 * looked up by fuzzy string comparison afterwards is a match you can't trust.
 */
function exerciseSchema(library: LibraryChoice[]) {
  const matchField = library.length
    ? {
        type: 'string',
        enum: ['', ...library.map((entry) => entry.name)],
        description:
          "The name of the library exercise that is the same movement as this one, or '' if none of them is. Match only when it really is the same movement performed the same way — a different variation is not a match. Wording may differ ('Sit-to-stand' and 'Sit to stand' are the same); the movement may not.",
      }
    : { type: 'string', description: 'Always the empty string — the library is empty.' };

  return {
    type: 'object',
    properties: {
      name: { type: 'string' },
      library_match: matchField,
      category: {
        type: 'string',
        description:
          "The part of the session this belongs to — 'Warm-up', 'Legs', 'Upper body', 'Core', 'Balance', 'Mobility', 'Cardio', 'Cool-down'. Use the source's own grouping when it has one. Empty string if the source gives no grouping at all.",
      },
      equipment: {
        type: 'string',
        description:
          "What the exercise needs — 'Dumbbells', 'Chair', 'Resistance band', 'Cable machine'. Use 'Body weight' when nothing is needed. Empty string only if the source is genuinely unclear.",
      },
      instructions: {
        type: 'string',
        description:
          'How to perform the exercise, in plain language. Empty string if the source gives none — do not invent technique cues.',
      },
      mode: {
        type: 'string',
        enum: ['reps', 'time'],
        description: "'reps' for counted repetitions, 'time' for a hold or duration.",
      },
      sets: { type: 'integer', description: 'Number of sets. Use 1 if unspecified.' },
      reps: { ...nullableInteger, description: "Reps per set. Null when mode is 'time'." },
      duration_seconds: {
        ...nullableInteger,
        description: "Seconds to hold or perform. Null when mode is 'reps'.",
      },
      rest_seconds: {
        type: 'integer',
        description: 'Rest after each set. Use 30 if unspecified.',
      },
    },
    required: [
      'name',
      'library_match',
      'category',
      'equipment',
      'instructions',
      'mode',
      'sets',
      'reps',
      'duration_seconds',
      'rest_seconds',
    ],
    additionalProperties: false,
  };
}

function workoutProperties(library: LibraryChoice[]) {
  return {
    title: { type: 'string' },
    subtitle: {
      type: 'string',
      description: 'Short description of the workout. Empty string if none is implied.',
    },
    exercises: { type: 'array', items: exerciseSchema(library) },
  };
}

/** One workout on its own, for importing into a week that already exists. */
function workoutSchema(library: LibraryChoice[]) {
  return {
    type: 'object',
    properties: workoutProperties(library),
    required: ['title', 'subtitle', 'exercises'],
    additionalProperties: false,
  };
}

function weekSchema(library: LibraryChoice[]) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short name for the week.' },
      note: {
        type: 'string',
        description:
          'One or two sentences addressed to the person doing the workouts. Empty string if the source gives no guidance.',
      },
      workouts: {
        type: 'array',
        description: 'One entry per workout session in the plan.',
        items: {
          type: 'object',
          properties: workoutProperties(library),
          required: ['title', 'subtitle', 'exercises'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'note', 'workouts'],
    additionalProperties: false,
  };
}

/**
 * Attaches the matched library entry's id, and drops any match that isn't
 * really in the library — the enum should make that impossible, but a draft
 * that quietly points at nothing would be worse than one that admits it.
 */
function resolveMatches(exercises: DraftExercise[], library: LibraryChoice[]): void {
  const byName = new Map(library.map((entry) => [entry.name, entry]));

  for (const exercise of exercises) {
    const entry = byName.get(exercise.library_match ?? '');
    if (entry) {
      exercise.library_id = entry.id;
      exercise.library_name = entry.name;
      continue;
    }

    exercise.library_match = '';

    // Second pass on the names alone. The model errs towards not matching,
    // and that costs the coach the video they recorded — but a guess is a
    // guess, so it's marked as one and left for them to accept.
    const guess = suggestMatch(exercise.name ?? '', library);
    if (guess) {
      exercise.library_id = guess.id;
      exercise.library_name = guess.name;
      exercise.library_suggested = true;
    }
  }
}

const SYSTEM_PROMPT = `You convert workout plans into structured data for a small family workout app. The people following these plans are the author's parents — typically older adults — so clarity matters more than brevity.

Rules:
- Transcribe what the source actually says. Do not invent exercises, sets, reps, or technique cues that are not there.
- When the source is vague about a number, choose a sensible conservative default (1 set, 30 seconds rest) rather than guessing something ambitious.
- Use "time" mode for holds, walks, and anything measured in seconds or minutes; "reps" for counted repetitions. Convert minutes to seconds.
- Write instructions in plain, warm language a parent can follow without jargon. If the source gives no technique detail, return an empty string rather than inventing one.
- If the source is a photo or screenshot and part of it is illegible, transcribe what you can read and leave the rest empty. Never fill gaps with plausible-sounding invention.
- Never output links or URLs. Videos are attached separately by hand.
- Where a library exercise is offered and one of them is the same movement, name it. That reuses the coach's own wording and their video. Different wording for the same movement still counts — "Bicep curls" is "Bicep Curl", and "Upward wall angel" is "Wall angel". A genuinely different exercise does not, however similar the name.`;

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ImportInput {
  text: string;
  images: { mediaType: string; base64: string }[];
}

/** Shared plumbing: same model, same rules, different shape of answer. */
async function draftFromSources<T>(
  input: ImportInput,
  schema: Record<string, unknown>,
  instruction: string,
): Promise<T> {
  if (!anthropicConfigured()) {
    throw new Error('No ANTHROPIC_API_KEY is set on this deployment.');
  }

  const client = new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = input.images.map((image) => ({
    type: 'image',
    source: { type: 'base64', media_type: image.mediaType as 'image/png', data: image.base64 },
  }));

  content.push({
    type: 'text',
    text: input.text.trim()
      ? `${instruction}:\n\n${input.text.trim()}`
      : `${instruction}. The source is the attached image(s).`,
  });

  const response = await client.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // Recommended for Opus 5: if safety classifiers decline, the API retries on
    // a fallback model rather than handing back an empty response.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process that input. Try rewording or a different source.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('That plan was too long to process in one go. Try a smaller piece of it.');
  }

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Claude returned no usable output.');
  }

  return JSON.parse(text.text) as T;
}

/**
 * Turns the pasted text and/or images into a whole week. The result is always
 * reviewed by the coach before it reaches anyone.
 */
export async function draftWeekFromSources(
  input: ImportInput,
  library: LibraryChoice[] = [],
): Promise<DraftWeek> {
  const draft = await draftFromSources<DraftWeek>(
    input,
    weekSchema(library),
    'Turn this into a structured week of workouts',
  );

  if (!draft.workouts?.length) {
    throw new Error('No workouts could be found in what you provided.');
  }

  for (const workout of draft.workouts) resolveMatches(workout.exercises ?? [], library);

  return draft;
}

/**
 * The same, for one session at a time — for when you're filling a week in
 * workout by workout rather than importing a whole plan at once.
 */
export async function draftWorkoutFromSources(
  input: ImportInput,
  library: LibraryChoice[] = [],
): Promise<DraftWorkout> {
  const draft = await draftFromSources<DraftWorkout>(
    input,
    workoutSchema(library),
    'Turn this into one structured workout. Everything described belongs to a single session, even if it is written as several parts or rounds',
  );

  if (!draft.exercises?.length) {
    throw new Error('No exercises could be found in what you provided.');
  }

  resolveMatches(draft.exercises, library);

  return draft;
}
