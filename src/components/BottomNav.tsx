'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, type IconName } from '@/components/Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Also light up for pages underneath this one. */
  match?: string;
  /** Other sections that belong to this item — a workout is still "This week". */
  also?: string[];
}

/**
 * The bar that stays put.
 *
 * Fixed to the bottom because that's where a thumb is, and padded for the home
 * indicator so the last item isn't half-swallowed on an iPhone. Pages leave
 * room for it via `pb-28` rather than the bar reserving space itself, which
 * keeps it out of the scroll flow entirely.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  /**
   * How well an item claims the current page, as the length of the longest
   * prefix it matches. Section roots are prefixes of everything beneath them —
   * "/admin" prefixes "/admin/library" — so the longest match has to win or
   * the first item stays lit across the whole section.
   */
  const strength = (item: NavItem) => {
    const bases = [item.match ?? item.href, ...(item.also ?? [])];
    return bases.reduce((best, base) => {
      const hit = pathname === base || pathname.startsWith(`${base}/`);
      return hit && base.length > best ? base.length : best;
    }, 0);
  };

  const scores = items.map(strength);
  const winner = scores.indexOf(Math.max(...scores));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch">
        {items.map((item, index) => {
          const active = scores[index] > 0 && index === winner;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 transition ${
                  active ? 'text-brand' : 'text-muted hover:text-ink'
                }`}
              >
                {/* The pill behind the icon does the work of an active state;
                    colour alone is easy to miss at a glance. */}
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                    active ? 'bg-brand-tint' : ''
                  }`}
                >
                  <Icon name={item.icon} className="h-[22px] w-[22px]" />
                </span>
                <span className="text-[11px] leading-none font-semibold tracking-wide">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
