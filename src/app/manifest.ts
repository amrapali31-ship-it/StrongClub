import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StrongClub',
    short_name: 'StrongClub',
    description: 'Your workouts for the week.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0e14',
    theme_color: '#0f0e14',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Listed again as maskable: they're full-bleed and opaque, so Android can
      // crop them to whatever shape the launcher uses. The mark sits well
      // inside the safe area. (Spelled as separate entries rather than
      // "any maskable" because Next's manifest type takes one purpose each.)
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
