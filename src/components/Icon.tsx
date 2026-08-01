/**
 * The handful of icons the navigation needs.
 *
 * Drawn rather than emoji: emoji render differently on every device and sit at
 * their own baseline, which is exactly the wobble you notice in a fixed bar.
 * These share one 24px grid and inherit `currentColor`.
 */
export type IconName = 'calendar' | 'chart' | 'person' | 'library' | 'sparkle' | 'chevron';

const PATHS: Record<IconName, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="6" height="17" rx="1.5" />
      <rect x="11" y="4" width="6" height="17" rx="1.5" />
      <path d="M19.5 5.5l2.2 15" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  chevron: <path d="M15 5l-7 7 7 7" />,
};

export function Icon({
  name,
  className = 'h-6 w-6',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
