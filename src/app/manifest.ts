import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Ajándoki',
    short_name: 'Ajándoki',
    description: 'Kívánságlisták, titkos foglalás és ajándékhúzás a családnak és a barátoknak.',
    lang: 'hu',
    start_url: '/ma',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f2e8',
    theme_color: '#163a2a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
