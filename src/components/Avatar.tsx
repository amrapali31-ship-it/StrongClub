import type { Profile } from '@/lib/types';

/**
 * A person's photo, falling back to their coloured initial. Used everywhere a
 * profile is shown so adding a photo updates all of them at once.
 */
export function Avatar({
  profile,
  size = 'md',
}: {
  profile: Pick<Profile, 'name' | 'color' | 'photo_url'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimensions = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-xl',
  }[size];

  if (profile.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.photo_url}
        alt=""
        className={`${dimensions} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: profile.color }}
    >
      {profile.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
