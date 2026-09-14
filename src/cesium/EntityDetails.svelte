<script lang="ts">
  // EntityDetails.svelte
  // -----------------------------------------------------------------------
  // The single, universal "show what I clicked on" panel for every entity
  // type (Live, Listing, Mission) selected from the Cesium globe. Owns its
  // own chrome (backdrop, panel, position, CloseButton) entirely — it is
  // the only place a globe-selected entity gets shown, so there's no
  // sibling component competing for the same job (see
  // missions/SwarmGovernance.svelte's header comment: that component is
  // creation-only now, Mission 2 in the HexMenu flow, and never renders
  // an existing record).
  //
  // Still a "dumb" display component (see orchestrator-prompt.md's UI
  // boundary: "All UI components are intentionally dumb"). It takes a
  // record — whatever Orchestrator.svelte looked up in the Store for the
  // entity the person just clicked on the Cesium globe — and renders it.
  // No Nostr, no discovery, no store access, no business logic beyond
  // picking apart which plain fields a given record kind has.
  //
  // Owner-only actions (Edit, Marketing, Delete): still no direct Nostr
  // communication here. Edit toggles this same panel into an editable
  // form (Mission only, for now — Listing/Live never had an edit
  // capability to begin with, so there's nothing to move over for them);
  // Save dispatches `submit` upward, Delete dispatches `delete` upward.
  // The actual publish/tombstone stays entirely in Orchestrator's
  // existing flow (see EntityLayer.svelte, which forwards both events,
  // and App.svelte, which turns them into Orchestrator's
  // `missionSubmit`/`deleteRequest` props). Marketing is pure UI
  // composition (a link built from two plain fields already on the
  // record), so it opens locally with no event needed.
  //
  // Location picking during Mission edit reuses cesium/api.ts's public
  // picker capability (never getActiveViewer() or any other
  // Cesium-internal API) — same mechanism SwarmGovernance's create form
  // uses. While editing a Mission, the backdrop is deliberately not
  // rendered (see the template below), so a click on the globe to pick a
  // new Point/Area reaches Cesium instead of just closing this panel.
  // -----------------------------------------------------------------------
  import { createEventDispatcher, onMount } from 'svelte';
  import type { LiveRecord, ListingRecord, MissionRecord, MissionLocation } from '../orchestrator/appStore';
  import { pick } from './api';
  import type { Coordinates, BoundingBox } from './api';
  import Marketing from '../shared/Marketing.svelte';
  import CloseButton from '../shared/CloseButton.svelte';

  export let record: LiveRecord | ListingRecord | MissionRecord | null = null;
  /** This client's own pubkey (from `$appStore.ownPubkey`) — compared against a listing's/mission's `author` to decide whether to show the owner-only actions below. Live records have no `author` field (no ownership concept), so they never show owner actions. */
  export let ownPubkey: string | null = null;

  const dispatch = createEventDispatcher();

  $: isOwner =
    !!record &&
    !!ownPubkey &&
    (record.kind === 'listing' || record.kind === 'mission') &&
    record.author === ownPubkey;

  let showMarketing = false;

  // On touch devices, the tap that picks a Cesium entity (opening this
  // panel) can be followed a moment later by the browser's own
  // synthesized "click" event for that same tap — landing on the
  // backdrop, which now sits exactly where the tap happened, and
  // immediately closing the panel again (visible as a brief flash).
  // Desktop doesn't have this: there Cesium's pick is driven directly by
  // the actual mouse click, so there's no second, delayed click to land
  // on the backdrop. EntityLayer.svelte remounts this component fresh
  // for each newly selected record (`{#if selectedRecord}`), so onMount
  // firing per-selection — not just once for the whole app — is exactly
  // what's needed here.
  let canCloseOnBackdrop = false;
  onMount(() => {
    const id = setTimeout(() => {
      canCloseOnBackdrop = true;
    }, 50);
    return () => clearTimeout(id);
  });

  // ─── Mission edit form — the only record kind with an edit capability ───

  type LaneId = 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

  const LANES: { id: LaneId; label: string; placeholder: string; required?: true }[] = [
    { id: 'brainstorming', label: 'Brainstorm', placeholder: 'https://… (required)', required: true },
    { id: 'meetanddo', label: 'Meet & do', placeholder: 'https://…' },
    { id: 'petition', label: 'Petition', placeholder: 'https://…' },
    { id: 'crowdfunding', label: 'Fund', placeholder: 'https://…' },
  ];

  let editing = false;
  let title = '';
  let description = '';
  let links: Record<LaneId, string> = {
    brainstorming: '',
    meetanddo: '',
    petition: '',
    crowdfunding: '',
  };
  let pickedLocation: MissionLocation | null = null;

  // Re-hydrate the edit form only when the selected mission actually
  // changes (a different one, or Mission <-> non-Mission) — not on every
  // reference change of the same one, so an in-progress edit never gets
  // clobbered by e.g. a background store refresh of the same mission.
  let hydratedId: string | null = null;
  $: if (record?.kind === 'mission' && record.id !== hydratedId) {
    title = record.content.title;
    description = record.content.description;
    links = { ...record.content.lanes };
    pickedLocation = record.location;
    editing = false;
    hydratedId = record.id;
  } else if (record?.kind !== 'mission' && hydratedId !== null) {
    editing = false;
    hydratedId = null;
  }

  $: formValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    links.brainstorming.trim().length > 0 &&
    pickedLocation !== null;

  // The picker owns its Cesium preview. Submit/Cancel are the explicit
  // points at which the preview is cleared.
  function clearPickerPreview(): void {
    pick.clear();
    pick.area.clear();
  }

  let pickingMode: 'point' | 'area' | null = null;

  function startPicking(mode: 'point' | 'area') {
    stopPicking();

    pickingMode = mode;

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
    if (pickingMode === 'point') pick.disable();
    if (pickingMode === 'area') pick.area.disable();
    pickingMode = null;
  }

  function clearLocation() {
    clearPickerPreview();
    pickedLocation = null;
  }

  function startEdit() {
    if (!record || record.kind !== 'mission') return;
    editing = true;
  }

  function cancelEdit() {
    if (!record || record.kind !== 'mission') return;
    clearPickerPreview();
    stopPicking();
    title = record.content.title;
    description = record.content.description;
    links = { ...record.content.lanes };
    pickedLocation = record.location;
    editing = false;
  }

  function handleMissionSubmit() {
    if (!record || record.kind !== 'mission' || !formValid || !pickedLocation) return;

    clearPickerPreview();

    dispatch('submit', {
      dTag: record.dTag,
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

    editing = false;
  }

  // ─── Shared actions ─────────────────────────────────────────────────────

  function close() {
    clearPickerPreview();
    stopPicking();
    dispatch('close');
  }

  function requestDelete() {
    if (!record) return;
    dispatch('delete', record);
    close(); // optimistic — the record disappears from the map once the tombstone round-trips; no reason to keep showing it now
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // ─── Pure formatting helpers — presentation only, no interpretation ───

  /** `some_id` / `some-id` -> `some id`. IDs in this app use either separator depending on where they come from. */
  function humanize(s: string): string {
    return s.replace(/[_-]/g, ' ');
  }

  function titleOf(r: LiveRecord | ListingRecord | MissionRecord): string {
    if (r.kind === 'mission') return r.content.title || 'Mission';
    const content = r.content as Record<string, unknown>;
    if (typeof content?.title === 'string' && content.title) return content.title;
    return humanize(r.model);
  }

  function categoryOf(r: LiveRecord | ListingRecord | MissionRecord): string | null {
    if (r.kind === 'mission') return null;
    const content = r.content as Record<string, unknown>;
    if (typeof content?.categoryId === 'string') return humanize(content.categoryId);
    if (Array.isArray(content?.categoryIds) && content.categoryIds.length) {
      return (content.categoryIds as string[]).map(humanize).join(', ');
    }
    return null;
  }

  function fieldOf(r: LiveRecord | ListingRecord | MissionRecord, key: string): string | null {
    const content = r.content as Record<string, unknown>;
    const value = content?.[key];
    return typeof value === 'string' && value ? value : null;
  }

  function formatCoords(loc: { latitude: number; longitude: number } | null): string | null {
    if (!loc) return null;
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  }

  function formatMissionLocation(loc: MissionLocation): string {
    if (loc.kind === 'point') {
      return `Point · ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    }
    return `Area · ${loc.west.toFixed(2)}, ${loc.south.toFixed(2)} → ${loc.east.toFixed(2)}, ${loc.north.toFixed(2)}`;
  }

  function formatTimestamp(unixSecs: number): string {
    return new Date(unixSecs * 1000).toLocaleString();
  }

  function shortPubkey(pk: string): string {
    return `${pk.slice(0, 8)}…${pk.slice(-8)}`;
  }

  const STATUS_LABEL: Record<string, string> = {
    searching: 'Searching',
    matched: 'Matched',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
</script>

<svelte:window on:keydown={onKeydown} />

{#if record}
  {#if !(record.kind === 'mission' && editing)}
    <div class="backdrop" on:click={() => canCloseOnBackdrop && close()} />
  {/if}

  <div class="panel" role="dialog" aria-modal="true">
    <div class="panel-header">
      <span
        class="kind-badge"
        class:live={record.kind === 'live'}
        class:mission={record.kind === 'mission'}
      >
        {record.kind === 'live' ? 'LIVE' : record.kind === 'mission' ? 'MISSION' : 'LISTING'}
      </span>
      <CloseButton onClose={close} position="relative" top="0" right="0" />
    </div>

    {#if record.kind === 'mission' && editing}
      <!-- ─── Mission edit form ─────────────────────────────────────── -->
      <form class="mf" on:submit|preventDefault={handleMissionSubmit}>
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
            <span>{formatMissionLocation(pickedLocation)}</span>
            <button type="button" class="mf-location-change" on:click={clearLocation}>
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
          <button type="button" class="mf-cancel" on:click={cancelEdit}>
            Cancel
          </button>
          <button type="submit" class="mf-submit" disabled={!formValid}>
            Save
          </button>
        </div>
      </form>
    {:else}
      <!-- ─── Read-only record view ─────────────────────────────────── -->
      <h2 class="title">{titleOf(record)}</h2>

      {#if record.kind !== 'mission'}
        <div class="model">{record.model.replace(/_/g, ' ')}</div>
      {/if}

      {#if record.kind === 'live'}
        <div class="status-row">
          <span
            class="status-dot"
            class:matched={record.status === 'matched'}
            class:expired={record.status === 'expired' || record.status === 'cancelled'}
          />
          <span>{STATUS_LABEL[record.status] ?? record.status}</span>
          <span class="role">({record.role})</span>
        </div>
        {#if record.peerPubkey}
          <div class="field">
            <span class="label">Peer</span>
            <span class="value mono">{shortPubkey(record.peerPubkey)}</span>
          </div>
        {/if}
      {:else if record.kind === 'listing'}
        <div class="field">
          <span class="label">Expires</span>
          <span class="value">{formatTimestamp(record.expiresAt)}</span>
        </div>
      {/if}

      {#if categoryOf(record)}
        <div class="field">
          <span class="label">Category</span>
          <span class="value">{categoryOf(record)}</span>
        </div>
      {/if}

      {#if fieldOf(record, 'description')}
        <p class="description">{fieldOf(record, 'description')}</p>
      {/if}

      {#if record.kind !== 'mission'}
        {#if fieldOf(record, 'contact')}
          <div class="field">
            <span class="label">Contact</span>
            <span class="value">{fieldOf(record, 'contact')}</span>
          </div>
        {/if}

        {#if fieldOf(record, 'interactionMode')}
          <div class="field">
            <span class="label">Format</span>
            <span class="value">{humanize(fieldOf(record, 'interactionMode') ?? '')}</span>
          </div>
        {/if}

        {#if formatCoords(record.location)}
          <div class="field">
            <span class="label">Location</span>
            <span class="value mono">{formatCoords(record.location)}</span>
          </div>
        {/if}
      {:else}
        <div class="field">
          <span class="label">Location</span>
          <span class="value mono">{formatMissionLocation(record.location)}</span>
        </div>

        <div class="mf-lanes-display">
          {#each LANES as lane}
            {#if record.content.lanes[lane.id]}
              <a
                class="mf-lane-link"
                href={record.content.lanes[lane.id]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {lane.label}
              </a>
            {/if}
          {/each}
        </div>
      {/if}

      {#if isOwner}
        <div class="owner-actions">
          {#if record.kind === 'mission'}
            <button class="owner-btn edit" on:click={startEdit}>Edit</button>
          {/if}
          <button class="owner-btn marketing" on:click={() => (showMarketing = true)}>Marketing</button>
          <button class="owner-btn delete" on:click={requestDelete}>Delete</button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

{#if showMarketing && record && record.kind !== 'live'}
  <Marketing
    domain={record.kind === 'mission' ? 'mission' : record.domain}
    eventId={record.eventId}
    on:close={() => (showMarketing = false)}
  />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.35);
  }

  .panel {
    position: fixed;
    top: 50%;
    right: 2em;
    transform: translateY(-50%);
    z-index: 41;
    width: min(360px, calc(100vw - 4em));
    max-height: min(600px, calc(100vh - 4em));
    overflow-y: auto;
    padding: 1.5em;
    border-radius: 14px;
    background: #16171a;
    border-left: 3px solid;
    border-image: linear-gradient(180deg, #335bf4, #2ae9c9) 1;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75em;
  }

  .kind-badge {
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25em 0.6em;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #8fb0ff;
  }
  .kind-badge.live {
    color: #2ae9c9;
  }
  .kind-badge.mission {
    color: #cbb6f0;
  }

  .title {
    margin: 0 0 0.15em;
    font-size: 1.2em;
    font-weight: 700;
    text-transform: capitalize;
  }

  .model {
    margin: 0 0 1em;
    font-size: 0.8em;
    color: #8a8f98;
    text-transform: capitalize;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.9em;
    font-size: 0.9em;
  }

  .status-dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: #ff6b6b;
    flex-shrink: 0;
  }
  .status-dot.matched {
    background: #57e389;
  }
  .status-dot.expired {
    background: #555;
  }

  .role {
    color: #8a8f98;
    text-transform: capitalize;
  }

  .field {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    padding: 0.5em 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.88em;
  }

  .label {
    color: #8a8f98;
    flex-shrink: 0;
  }

  .value {
    text-align: right;
    text-transform: capitalize;
  }

  .value.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-transform: none;
  }

  .description {
    margin: 0.9em 0 0;
    padding-top: 0.9em;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.88em;
    line-height: 1.5;
    color: #dcdcdc;
  }

  .owner-actions {
    display: flex;
    gap: 0.6em;
    margin-top: 1.1em;
    padding-top: 1em;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .owner-btn {
    flex: 1;
    padding: 0.45em 0;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85em;
    cursor: pointer;
  }

  .owner-btn.edit {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #eee;
  }
  .owner-btn.edit:hover,
  .owner-btn.edit:focus-visible {
    background: rgba(255, 255, 255, 0.08);
  }

  .owner-btn.marketing {
    background: linear-gradient(90deg, #335bf4, #2ae9c9);
    border: none;
    color: #0b0b0d;
  }
  .owner-btn.marketing:hover,
  .owner-btn.marketing:focus-visible {
    filter: brightness(1.08);
  }

  .owner-btn.delete {
    background: transparent;
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
  }
  .owner-btn.delete:hover,
  .owner-btn.delete:focus-visible {
    background: rgba(255, 107, 107, 0.12);
  }

  /* ─── Mission fields (edit form + lane pills) — kept visually distinct
     with the same mission-purple accent SwarmGovernance's create form
     uses, so a Mission still "reads" as a Mission even though EntityDetails
     now owns its display. ─────────────────────────────────────────────── */

  .mf {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: #eee;
    font-family: inherit;
  }

  .mf-label {
    margin-top: 0.75rem;
    font-size: 0.7em;
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
    font-size: 0.85rem;
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

  /* Single column — this panel is narrower than the old .mission-modal-content,
     so the two-column lane grid SwarmGovernance's create form uses would be
     cramped here. */
  .mf-lanes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
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
    font-size: 0.78rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .mf-location-change {
    flex-shrink: 0;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #eee;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
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
    font-size: 0.78rem;
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
    margin-top: 1.25rem;
    display: flex;
    gap: 0.6rem;
  }

  .mf-cancel {
    padding: 0.55rem 0.9rem;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    color: #eee;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .mf-cancel:hover,
  .mf-cancel:focus-visible {
    background: rgba(255, 255, 255, 0.08);
  }

  .mf-submit {
    flex: 1;
    padding: 0.55rem 0.9rem;
    background: #7e57c2;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
  }
  .mf-submit:disabled {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.4);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: no-preference) {
    .panel {
      animation: slide-in 0.18s ease-out;
    }
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  /* Mobile/narrow viewports: center the panel instead of anchoring it to
     the right edge, and keep it within the viewport either way. The
     entrance animation gets its own mobile variant too, since it
     otherwise re-applies the desktop transform (translateY only, no
     horizontal centering) and would jump on first appearance. */
  @media (max-width: 700px) {
    .panel {
      left: 50%;
      right: auto;
      transform: translate(-50%, -50%);
      width: min(360px, calc(100vw - 2em));
      max-height: calc(100vh - 2em);
    }
  }
  @media (max-width: 700px) and (prefers-reduced-motion: no-preference) {
    .panel {
      animation: slide-in-mobile 0.18s ease-out;
    }
  }
  @keyframes slide-in-mobile {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
