import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'StrongClub',
  description: 'Your workouts for the week.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'StrongClub',
    // Added to the home screen, the app runs full-screen — a light status bar
    // would sit oddly above a near-black page.
    statusBarStyle: 'black',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0e14',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available; we just don't want a double-tap zoom while
  // someone is tapping "Done" mid-workout.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
