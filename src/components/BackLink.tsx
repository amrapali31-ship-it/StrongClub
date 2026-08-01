import Link from 'next/link';

import { Icon } from '@/components/Icon';

/**
 * One back control, used everywhere, so "up a level" is always the same shape
 * in the same corner. Sized as a proper tap target rather than a line of text.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-base font-semibold text-muted transition hover:text-ink"
    >
      <Icon name="chevron" className="h-5 w-5" />
      {label}
    </Link>
  );
}
