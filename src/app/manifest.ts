import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StrongClub',
    short_name: 'StrongClub',
    description: 'Your workouts for the week.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3ec',
    theme_color: '#f7f3ec',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
