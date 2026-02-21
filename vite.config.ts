import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [
    svelte(),
    cesium(),
  ],
  define: {
    'process.env': process.env,
  },
})
