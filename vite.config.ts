import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import cesium from 'vite-plugin-cesium'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    cesium(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32x32.png'],
      manifest: {
        name: 'CLOUD ATLAS OS',
        short_name: 'Cloud Atlas',
        description:
          'What if the world was run by you and me? Science fiction meets the real world. ' +
          'Cloud Atlas OS is a community-owned super-app where the entire gig economy lives under one roof ' +
          '— ridesharing, delivery, freelance, spontaneous connections — with zero commissions. ' +
          'Keep 100% of what you earn. We\'ll teach you how to keep it, legally. ' +
          'But that\'s just the beginning. ' +
          'Govern your city through SWARM GOVERNANCE — brainstorm, petition, crowdfund, and organize real change. ' +
          'Stream your impact live on MissionTV and get paid for the causes you love. ' +
          'Explore OMNIPEDIA — 6 million Wikipedia articles transformed into immersive 3D worlds on a live global map. ' +
          'Build apps, games, and experiences in seconds with the HOLODECK — no coding required. ' +
          'Think Google Maps, Wikipedia, Twitch, Kickstarter, and an App Store — raised by the open-source community. ' +
          'Community-owned. Open-source. Yours. Redefine the way we live together.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['education', 'entertainment', 'social'],
        icons: [
          { src: 'icons/icon_192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon_256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon_384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon_512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: 'screenshot-wide.jpg',
            sizes: '1408x736',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Cloud Atlas OS - Explore the 3D Globe',
          },
          {
            src: 'screenshot-mobile.jpg',
            sizes: '562x1280',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Cloud Atlas OS - Mobile Experience',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/cesium/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.cesium\.com\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cesium-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nominatim-geocoding',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:mp4|webm|jpg|jpeg|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-assets',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/cloudatlas\.club\//i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cloudatlas-assets',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    'process.env': process.env,
  },
});