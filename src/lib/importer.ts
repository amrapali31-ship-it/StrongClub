import Anthropic from '@anthropic-ai/sdk';

import type { ExerciseMode } from '@/lib/types';

export interface DraftExercise {
  name: string;
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

/**
 * Structured-output schema. Every field is required and `additionalProperties`
 * is false throughout, which is what lets the API guarantee the shape rather
 * than us hoping the model returns valid JSON.
 */
const WEEK_SCHEMA = {
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
        properties: {
          title: { type: 'string' },
          subtitle: {
            type: 'string',
            description: 'Short description of the workout. Empty string if none is implied.',
          },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
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
                'equipment',
                'instructions',
                'mode',
                'sets',
                'reps',
                'duration_seconds',
                'rest_seconds',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'subtitle', 'exercises'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'note', 'workouts'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You convert workout plans into structured data for a small family workout app. The people following these plans are the author's parents — typically older adults — so clarity matters more than brevity.

Rules:
- Transcribe what the source actually says. Do not invent exercises, sets, reps, or technique cues that are not there.
- When the source is vague about a number, choose a sensible conservative default (1 set, 30 seconds rest) rather than guessing something ambitious.
- Use "time" mode for holds, walks, and anything measured in seconds or minutes; "reps" for counted repetitions. Convert minutes to seconds.
- Write instructions in plain, warm language a parent can follow without jargon. If the source gives no technique detail, return an empty string rather than inventing one.
- If the source is a photo or screenshot and part of it is illegible, transcribe what you can read and leave the rest empty. Never fill gaps with plausible-sounding invention.
- Never output links or URLs. Videos are attached separately by hand.`;

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ImportInput {
  text: string;
  images: { mediaType: string; base64: string }[];
}

/**
 * Sends the pasted text and/or images to Claude and returns a structured week.
 * The result is always reviewed by the coach before it reaches anyone.
 */
export async function draftWeekFromSources(input: ImportInput): Promise<DraftWeek> {
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
      ? `Turn this into a structured week of workouts:\n\n${input.text.trim()}`
      : 'Turn the attached image(s) into a structured week of workouts.',
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
      format: { type: 'json_schema', schema: WEEK_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process that input. Try rewording or a different source.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('That plan was too long to process in one go. Try importing one week at a time.');
  }

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Claude returned no usable output.');
  }

  const draft = JSON.parse(text.text) as DraftWeek;
  if (!draft.workouts?.length) {
    throw new Error('No workouts could be found in what you provided.');
  }

  return draft;
}
