import './app.css'
import './shared-styles.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app')!,
})

// Cleanup function for proper app destruction
export function destroyApp() {
  if (app) {
    app.$destroy();
  }
}

// Handle page unload
window.addEventListener('beforeunload', destroyApp);

export default app
