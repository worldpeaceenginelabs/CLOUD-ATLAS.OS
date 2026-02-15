import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import cesium from 'vite-plugin-cesium'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), cesium()],
  define: {
    // This is optional if you want to explicitly define global constants.
    'process.env': process.env
  }
});