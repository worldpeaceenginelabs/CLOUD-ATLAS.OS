<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { globe, type Coordinates, type RoutePreview } from '../cesium/api';
  
    export let geometry: 'point' | 'route' = 'point';

  const dispatch = createEventDispatcher<{
      confirm:
        | { geometry: 'point'; point: { latitude:number; longitude:number } }
        | { geometry:'route'; from:{ latitude:number; longitude:number}; to:{ latitude:number; longitude:number}};
      cancel: void;
    }>();
  
    let status: 'locating' | 'picking' | 'previewing' | 'error' = 'locating';
    let errorMessage = '';
  
    let fromCoords: Coordinates | null = null;
    let toCoords: Coordinates | null = null;
    let preview: RoutePreview | null = null;
  
    function clearPreview(): void {
      preview?.remove();
      preview = null;
    }
  
    function showPreview(from: Coordinates, to: Coordinates): void {
      clearPreview();
      preview = globe.route.preview(from, to);
      status = 'previewing';
    }
  
    
function handlePick(coords: Coordinates | null): void {
      if (!coords) return;
      if (geometry === 'point') {
        fromCoords = coords;
        status = 'previewing';
        return;
      }
      if (!fromCoords) return;
      toCoords = coords;
      showPreview(fromCoords, toCoords);
    }
  
    function pickAgain(): void {
      toCoords = null;
      clearPreview();
      status = 'picking';
    }
  
    function confirm(): void {
      if (geometry==='point') {
      if (!fromCoords) return;
      globe.pick.disable();
      dispatch('confirm',{geometry:'point',point:{latitude:fromCoords.latitude,longitude:fromCoords.longitude}});
      return;
    }
    if (!fromCoords || !toCoords) return;
  
      clearPreview();
      globe.pick.disable();
  
      dispatch('confirm', { geometry:'route',
        from: { latitude: fromCoords.latitude, longitude: fromCoords.longitude },
        to: { latitude: toCoords.latitude, longitude: toCoords.longitude }
      });
    }
  
    function cancel(): void {
      clearPreview();
      globe.pick.disable();
      dispatch('cancel');
    }
  
    onMount(async () => {
      try {
        
if (geometry==='route') {
          fromCoords = await globe.location.getCurrentPosition();
        }
        status='picking';
        globe.pick.enable(handlePick);
      } catch (err) {
        status = 'error';
        errorMessage = err instanceof Error ? err.message : 'Position konnte nicht ermittelt werden.';
      }
    });
  
    onDestroy(() => {
      clearPreview();
      globe.pick.disable();
    });
  </script>
  
  <div class="backdrop" on:click={(e) => {
    if (e.target === e.currentTarget) cancel();
  }}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Location">
  
      <button class="close" on:click={cancel} aria-label="Close">✕</button>
  
      <h2>LOCATION</h2>
  
      {#if status === 'locating'}
        <p class="hint">Determining your location…</p>
  
      {:else if status === 'error'}
        <p class="error">{errorMessage}</p>
  
      {:else if status === 'picking'}
        <p class="hint">
          {geometry === 'point'
            ? 'Select a location on the globe.'
            : 'Select the destination point on the globe.'}
        </p>
  
      {:else if status === 'previewing'}
        <p class="hint">
          {geometry === 'point'
            ? 'Location selected.'
            : 'Route selected.'}
        </p>
      {/if}
  
  
      <div class="actions">
  
        {#if status === 'previewing'}
          <button class="primary" on:click={confirm}>
            {geometry === 'point'
              ? 'Use this location'
              : 'Use this route'}
          </button>
  
          {#if geometry === 'route'}
            <button class="secondary" on:click={pickAgain}>
              Pick again
            </button>
          {/if}
  
        {:else if status === 'error'}
          <button class="secondary" on:click={cancel}>
            Close
          </button>
  
        {:else if status === 'picking'}
          <button class="secondary" on:click={cancel}>
            Cancel
          </button>
        {/if}
  
      </div>
  
    </div>
  </div>
  
  <style>
    .backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 24px 0;
}

.modal {
  position: relative;
  background: #161616;
  border: 1px solid #333;
  border-radius: 14px;
  padding: 28px 24px 24px;
  width: min(360px, calc(100vw - 40px));
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

h2 {
  margin: 0 0 6px;
  color: #fff;
  font-size: 1em;
  letter-spacing: 1.5px;
  text-align: center;
}

.hint {
  margin: 0 0 18px;
  color: #888;
  font-size: 0.78em;
  text-align: center;
}

.close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #888;
  font-size: 1em;
  cursor: pointer;
  line-height: 1;
  padding: 6px;
}

.close:hover {
  color: #fff;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

button {
  border-radius: 10px;
  padding: 11px 12px;
  font-size: 0.9em;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  border: 1.5px solid;
  border-image: linear-gradient(90deg,#335bf4,#2ae9c9) 1;
  background:#111;
  color:#fff;
}

.primary:hover {
  background: rgba(51,91,244,0.38);
}

.secondary {
  background:#111;
  border:1px solid #333;
  color:#aaa;
}

.secondary:hover {
  color:#fff;
  border-color:#666;
}

.error {
  color:#e05252;
  text-align:center;
}
  </style>