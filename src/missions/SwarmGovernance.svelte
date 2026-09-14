<script lang="ts">
  // missions/SwarmGovernance.svelte
  // -----------------------------------------------------------------------
  // Mission 2 in the HexMenu creation flow — new-mission form only.
  //
  // Viewing/editing an *existing* mission is EntityDetails.svelte's job
  // now (see cesium/EntityDetails.svelte's Mission Edit section) — this
  // component no longer has a `record` prop, no read-only/owner mode, no
  // Marketing/Delete. It never renders its own chrome (no `.panel`, no
  // backdrop, no CloseButton): HexMenu.svelte owns the surrounding modal
  // (.mission-modal-content) and the shared CloseButton, exactly like
  // Mission1.svelte and Omnipedia.svelte.
  //
  // Still primarily UI: it renders the form, lets the user pick a Point
  // or Area location through cesium/api.ts's public picker capability
  // (never getActiveViewer() or any other Cesium-internal API), builds
  // the mission payload, and dispatches `submit`/`picking` — no direct
  // Nostr communication here. The actual publish stays entirely in
  // Orchestrator's existing flow (App.svelte -> missionSubmit prop).
  // -----------------------------------------------------------------------

  import { createEventDispatcher, onDestroy } from 'svelte';
  import { pick } from '../cesium/api';
  import type { Coordinates, BoundingBox } from '../cesium/api';
  import type { MissionLocation } from '../orchestrator/appStore';

  const dispatch = createEventDispatcher();

  type LaneId = 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

  const LANES: { id: LaneId; label: string; placeholder: string; required?: true }[] = [
    { id: 'brainstorming', label: 'Brainstorm', placeholder: 'https://… (required)', required: true },
    { id: 'meetanddo', label: 'Meet & do', placeholder: 'https://…' },
    { id: 'petition', label: 'Petition', placeholder: 'https://…' },
    { id: 'crowdfunding', label: 'Fund', placeholder: 'https://…' },
  ];

  let title = '';
  let description = '';
  let links: Record<LaneId, string> = {
    brainstorming: '',
    meetanddo: '',
    petition: '',
    crowdfunding: '',
  };
  let pickedLocation: MissionLocation | null = null;

  $: formValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    links.brainstorming.trim().length > 0 &&
    pickedLocation !== null;

  // The picker owns its Cesium preview. Submit is the explicit point
  // at which the preview is cleared.
  function clearPickerPreview(): void {
    pick.clear();
    pick.area.clear();
  }

  function handleSubmit() {
    if (!formValid || !pickedLocation) return;

    clearPickerPreview();

    dispatch('submit', {
      title: title.trim(),
      description: description.trim(),
      location: pickedLocation,
      lanes: {
        brainstorming: links.brainstorming.trim(),
        meetanddo: links.meetanddo.trim(),
        petition: links.petition.trim(),
        crowdfunding: links.crowdfunding.trim(),
      },
    });
  }

  // ─── Location picking (Point or Area — never Route, per the mission spec) ──

  let pickingMode: 'point' | 'area' | null = null;

  function startPicking(mode: 'point' | 'area') {
    stopPicking();

    pickingMode = mode;
    dispatch('picking', true);

    if (mode === 'point') {
      pick.enable((coords: Coordinates | null) => {
        if (coords) {
          pickedLocation = {
            kind: 'point',
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }

        // disable() only stops picking. The selected point remains visible.
        stopPicking();
      });

      return;
    }

    pick.area.enable((box: BoundingBox) => {
      pickedLocation = {
        kind: 'area',
        ...box,
      };

      // disable() only stops picking. The selected rectangle remains visible.
      stopPicking();
    });
  }

  function stopPicking() {
    const wasPicking = pickingMode !== null;

    if (pickingMode === 'point') {
      pick.disable();
    }

    if (pickingMode === 'area') {
      pick.area.disable();
    }

    pickingMode = null;

    if (wasPicking) {
      setTimeout(() => {
        dispatch('picking', false);
      }, 0);
    }
  }

  function clearLocation() {
    clearPickerPreview();
    pickedLocation = null;
  }

  onDestroy(() => {
    clearPickerPreview();
    stopPicking();
  });
</script>

<div class="mission-card">
  <form class="mf" on:submit|preventDefault={handleSubmit}>
    <h2 class="mf-heading">Swarm Governance</h2>

    <label class="mf-label" for="mf-title">Title</label>
    <input
      id="mf-title"
      class="mf-input"
      type="text"
      bind:value={title}
      placeholder="Mission title"
    />

    <label class="mf-label" for="mf-description">Description</label>
    <textarea
      id="mf-description"
      class="mf-textarea"
      rows="3"
      bind:value={description}
      placeholder="What is this mission about?"
    />

    <div class="mf-lanes">
      {#each LANES as lane}
        <div class="mf-lane">
          <label class="mf-label" for="mf-lane-{lane.id}">
            {lane.label}{lane.required ? ' *' : ''}
          </label>
          <input
            id="mf-lane-{lane.id}"
            class="mf-input"
            type="text"
            bind:value={links[lane.id]}
            placeholder={lane.placeholder}
          />
        </div>
      {/each}
    </div>

    <span class="mf-label">Location *</span>

    {#if pickedLocation}
      <div class="mf-location-preview">
        {#if pickedLocation.kind === 'point'}
          <span>
            Point · {pickedLocation.latitude.toFixed(4)}, {pickedLocation.longitude.toFixed(4)}
          </span>
        {:else}
          <span>
            Area · {pickedLocation.west.toFixed(2)}, {pickedLocation.south.toFixed(2)} →
            {pickedLocation.east.toFixed(2)}, {pickedLocation.north.toFixed(2)}
          </span>
        {/if}

        <button
          type="button"
          class="mf-location-change"
          on:click={clearLocation}
        >
          Change
        </button>
      </div>
    {:else}
      <div class="mf-location-buttons">
        <button
          type="button"
          class="mf-location-btn"
          class:picking={pickingMode === 'point'}
          on:click={() => startPicking('point')}
        >
          {pickingMode === 'point' ? 'Click the globe…' : 'Pick Point'}
        </button>

        <button
          type="button"
          class="mf-location-btn"
          class:picking={pickingMode === 'area'}
          on:click={() => startPicking('area')}
        >
          {pickingMode === 'area' ? 'Drag on the globe…' : 'Pick Area'}
        </button>
      </div>
    {/if}

    <div class="mf-actions">
      <button type="submit" class="mf-submit" disabled={!formValid}>
        Submit
      </button>
    </div>
  </form>
</div>

<style>
  .mission-card {
    color: #eee;
  }

  .mf {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: #eee;
    font-family: inherit;
  }

  .mf-heading {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
  }

  .mf-label {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
  }

  .mf-input,
  .mf-textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.65rem;
    margin-top: 0.25rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    font-family: inherit;
  }

  .mf-textarea {
    resize: vertical;
  }

  .mf-input:focus,
  .mf-textarea:focus {
    outline: none;
    border-color: #7e57c2;
  }

  .mf-lanes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 0.75rem;
  }

  .mf-lane {
    display: flex;
    flex-direction: column;
  }

  .mf-location-preview {
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 0.82rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .mf-location-change {
    flex-shrink: 0;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #eee;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .mf-location-change:hover,
  .mf-location-change:focus-visible {
    background: rgba(255, 255, 255, 0.1);
  }

  .mf-location-buttons {
    margin-top: 0.25rem;
    display: flex;
    gap: 0.5rem;
  }

  .mf-location-btn {
    flex: 1;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #eee;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mf-location-btn:hover,
  .mf-location-btn:focus-visible {
    background: rgba(255, 255, 255, 0.1);
  }

  .mf-location-btn.picking {
    border-color: #7e57c2;
    color: #cbb6f0;
  }

  .mf-actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.6rem;
  }

  .mf-submit {
    flex: 1;
    padding: 0.65rem 1rem;
    background: #7e57c2;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mf-submit:disabled {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.4);
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .mf-lanes {
      grid-template-columns: 1fr;
    }

    .mf-location-buttons {
      flex-direction: column;
    }
  }
</style>
