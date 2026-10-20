import type { MetadataRoute } from 'next';

// Makes "Add to Home Screen" open FitLeague full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FitLeague',
    short_name: 'FitLeague',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F5F1',
    theme_color: '#14181F',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
