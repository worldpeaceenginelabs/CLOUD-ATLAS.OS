<script lang="ts">
  // missions/SwarmGovernance.svelte
  // -----------------------------------------------------------------------
  // The Mission card. One component, three states, exactly as specified:
  //
  //   record === null              -> new mission, fully editable
  //   record !== null, !isOwner    -> read-only details card
  //   record !== null, isOwner     -> read-only details card + Edit/
  //                                     Marketing/Delete; Edit switches
  //                                     the same fields back to editable
  //
  // For a new mission, HexMenu owns the surrounding modal chrome.
  // For an existing mission selected from Cesium, this component owns its
  // own detail backdrop/panel, exactly like EntityDetails.svelte.
  //
  // Still primarily UI: it renders fields, lets the user pick a Point or
  // Area location through cesium/api.ts's public picker capability (never
  // getActiveViewer() or any other Cesium-internal API), builds the mission
  // payload, and dispatches `submit`/`delete`/`close` — no direct Nostr
  // communication here. The actual publish/tombstone stays entirely
  // in Orchestrator's existing flow.
  // -----------------------------------------------------------------------

  import { createEventDispatcher, onDestroy } from 'svelte';
  import { pick } from '../cesium/api';
  import type { Coordinates, BoundingBox } from '../cesium/api';
  import type { MissionRecord, MissionLocation } from '../orchestrator/appStore';
  import Marketing from '../shared/Marketing.svelte';

  export let record: MissionRecord | null = null;
  /** This client's own pubkey (from `$appStore.ownPubkey`) — compared against a mission's `author` to decide whether to show owner-only actions, same convention as cesium/EntityDetails.svelte. */
  export let ownPubkey: string | null = null;

  const dispatch = createEventDispatcher();

  type LaneId = 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

  const LANES: { id: LaneId; label: string; placeholder: string; required?: true }[] = [
    { id: 'brainstorming', label: 'Brainstorm', placeholder: 'https://… (required)', required: true },
    { id: 'meetanddo', label: 'Meet & do', placeholder: 'https://…' },
    { id: 'petition', label: 'Petition', placeholder: 'https://…' },
    { id: 'crowdfunding', label: 'Fund', placeholder: 'https://…' },
  ];

  $: isExisting = record !== null;
  $: isOwner = !!record && !!ownPubkey && record.author === ownPubkey;

  let editing = false;
  /** A new mission is always editable; an existing one only once its owner clicks Edit. */
  $: editable = !isExisting || editing;

  let title = '';
  let description = '';
  let links: Record<LaneId, string> = {
    brainstorming: '',
    meetanddo: '',
    petition: '',
    crowdfunding: '',
  };
  let pickedLocation: MissionLocation | null = null;

  // Re-hydrate the form only when the selected mission actually changes
  // (a different one, or new <-> existing) — not on every reference
  // change of the same one, so an in-progress edit never gets clobbered
  // by e.g. a background store refresh of the same underlying mission.
  let hydratedId: string | null = null;
  $: if (record && record.id !== hydratedId) {
    title = record.content.title;
    description = record.content.description;
    links = { ...record.content.lanes };
    pickedLocation = record.location;
    editing = false;
    hydratedId = record.id;
  } else if (!record && hydratedId !== null) {
    title = '';
    description = '';
    links = {
      brainstorming: '',
      meetanddo: '',
      petition: '',
      crowdfunding: '',
    };
    pickedLocation = null;
    editing = false;
    hydratedId = null;
  }

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
      dTag: record?.dTag,
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

    if (isExisting) editing = false;
  }

  function cancelEdit() {
    if (!record) return;
    clearPickerPreview();
    title = record.content.title;
    description = record.content.description;
    links = { ...record.content.lanes };
    pickedLocation = record.location;
    editing = false;
    stopPicking();
  }

  function requestDelete() {
    if (!record) return;
    dispatch('delete', record);
  }

  function close() {
    clearPickerPreview();
    stopPicking();
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isExisting) {
      close();
    }
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

  // ─── Marketing ──────────────────────────────────────────────────────────

  let showMarketing = false;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isExisting}

    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-label="Mission details"

    >
      <button class="close-btn" type="button" aria-label="Close" on:click={close}>✕</button>

      <div class="mission-card">
        {#if editable}
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
              {#if isExisting}
                <button type="button" class="mf-cancel" on:click={cancelEdit}>
                  Cancel
                </button>
              {/if}

              <button type="submit" class="mf-submit" disabled={!formValid}>
                {isExisting ? 'Save' : 'Submit'}
              </button>
            </div>
          </form>
        {:else}
          <div class="mf">
            <h2 class="mf-heading">Swarm Governance</h2>

            <h3 class="mf-title-display">{title}</h3>
            <p class="mf-description-display">{description}</p>

            {#if pickedLocation}
              <div class="mf-field">
                <span class="mf-label">Location</span>

                {#if pickedLocation.kind === 'point'}
                  <div class="mf-value">
                    Point · {pickedLocation.latitude.toFixed(4)}, {pickedLocation.longitude.toFixed(4)}
                  </div>
                {:else}
                  <div class="mf-value">
                    Area · {pickedLocation.west.toFixed(2)}, {pickedLocation.south.toFixed(2)} →
                    {pickedLocation.east.toFixed(2)}, {pickedLocation.north.toFixed(2)}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="mf-lanes mf-lanes-display">
              {#each LANES as lane}
                {#if links[lane.id]}
                  <a
                    class="mf-lane-link"
                    href={links[lane.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {lane.label}
                  </a>
                {/if}
              {/each}
            </div>

            {#if isOwner}
              <div class="mf-owner-actions">
                <button
                  type="button"
                  class="mf-owner-btn"
                  on:click={() => (editing = true)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="mf-owner-btn marketing"
                  on:click={() => (showMarketing = true)}
                >
                  Marketing
                </button>

                <button
                  type="button"
                  class="mf-owner-btn delete"
                  on:click={requestDelete}
                >
                  Delete
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

{:else}
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
{/if}

{#if showMarketing && record}
  <Marketing
    domain="mission"
    eventId={record.eventId}
    on:close={() => (showMarketing = false)}
  />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    z-index: 9999;
  }

  .panel {
    position: relative;
    width: min(640px, 92vw);
    max-height: 88vh;
    overflow-y: auto;
    box-sizing: border-box;
    background: #1b1b1b;
    border: 1px solid rgba(126, 87, 194, 0.5);
    border-radius: 14px;
    padding: 2.5rem 1.5rem 1.5rem;
  }

  .close-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #eee;
    font-size: 1rem;
    cursor: pointer;
  }

  .close-btn:hover,
  .close-btn:focus-visible {
    background: rgba(255, 255, 255, 0.15);
  }

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

  .mf-lanes-display {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .mf-lane-link {
    background: rgba(126, 87, 194, 0.18);
    border: 1px solid rgba(126, 87, 194, 0.5);
    color: #cbb6f0;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
  }

  .mf-lane-link:hover,
  .mf-lane-link:focus-visible {
    background: rgba(126, 87, 194, 0.3);
  }

  .mf-title-display {
    margin: 0.25rem 0 0;
    font-size: 1.2rem;
    color: #fff;
  }

  .mf-description-display {
    margin: 0.4rem 0 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: #dcdcdc;
    white-space: pre-wrap;
  }

  .mf-field {
    margin-top: 0.6rem;
  }

  .mf-value {
    margin-top: 0.2rem;
    font-size: 0.85rem;
    color: #eee;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

  .mf-cancel {
    padding: 0.65rem 1rem;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    color: #eee;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .mf-cancel:hover,
  .mf-cancel:focus-visible {
    background: rgba(255, 255, 255, 0.08);
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

  .mf-owner-actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mf-owner-btn {
    flex: 1;
    padding: 0.45rem 0;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #eee;
  }

  .mf-owner-btn:hover,
  .mf-owner-btn:focus-visible {
    background: rgba(255, 255, 255, 0.08);
  }

  .mf-owner-btn.marketing {
    background: #7e57c2;
    border: none;
    color: #fff;
  }

  .mf-owner-btn.marketing:hover,
  .mf-owner-btn.marketing:focus-visible {
    filter: brightness(1.08);
  }

  .mf-owner-btn.delete {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }

  .mf-owner-btn.delete:hover,
  .mf-owner-btn.delete:focus-visible {
    background: rgba(255, 107, 107, 0.12);
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
