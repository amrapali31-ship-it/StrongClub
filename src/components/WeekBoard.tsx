import Link from 'next/link';

import type { WorkoutProgress } from '@/lib/queries';
import type { Week } from '@/lib/types';

export function formatWeek(week: Week): string {
  if (!week.start_date) return '';
  const date = new Date(`${week.start_date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function WeekBoard({ week, board }: { week: Week; board: WorkoutProgress[] }) {
  const doneCount = board.filter((b) => b.status === 'done').length;
  const dateLabel = formatWeek(week);

  return (
    <>
      <div className="mb-6">
        {dateLabel && (
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">
            Week of {dateLabel}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{week.title}</h1>
        {week.note && <p className="mt-3 text-lg leading-relaxed text-muted">{week.note}</p>}

        {board.length > 0 && (
          <p className="mt-4 text-base text-muted">
            {doneCount === board.length ? (
              <span className="font-semibold text-success">
                All {board.length} done this week. Wonderful.
              </span>
            ) : (
              <>
                <span className="font-semibold text-ink">
                  {doneCount} of {board.length}
                </span>{' '}
                finished &mdash; do them in any order that suits you.
              </>
            )}
          </p>
        )}
      </div>

      {board.length === 0 ? (
        <p className="card p-6 text-center text-muted">
          Nothing here yet. Check back once this week&rsquo;s workouts are added.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {board.map((item) => (
            <li key={item.workout.id}>
              <WorkoutCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WorkoutCard({ item }: { item: WorkoutProgress }) {
  const { workout, exercises, status, fraction, estimatedMinutes } = item;

  return (
    <Link
      href={`/workout/${workout.id}`}
      className="card flex items-center gap-4 p-4 transition hover:border-ink/25 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{workout.title}</h2>
          {status === 'done' && (
            <span className="shrink-0 rounded-full bg-success-tint px-2.5 py-0.5 text-xs font-bold text-success">
              Done
            </span>
          )}
        </div>

        {workout.subtitle && <p className="mt-0.5 text-muted">{workout.subtitle}</p>}

        <p className="mt-1.5 text-sm text-muted">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} &middot; about{' '}
          {estimatedMinutes} min
        </p>

        {status === 'in-progress' && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted">
              {Math.round(fraction * 100)}%
            </span>
          </div>
        )}
      </div>

      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
          status === 'done' ? 'bg-success-tint text-success' : 'bg-brand-tint text-brand'
        }`}
        aria-hidden
      >
        {status === 'done' ? '✓' : '›'}
      </span>
    </Link>
  );
}
