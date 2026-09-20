<script lang="ts">
  // EntityDetails.svelte
  // -----------------------------------------------------------------------
  // The single, universal "show what I clicked on" panel for every entity
  // type (Listing, Mission) selected from the Cesium globe. Owns its
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
  // Owner-only actions (Edit, Delete): still no direct Nostr
  // communication here. Edit toggles this same panel into an editable
  // form (Mission only, for now — Listing never had an edit
  // capability to begin with, so there's nothing to move over for them);
  // Save dispatches `submit` upward, Delete dispatches `delete` upward.
  // The actual publish/tombstone stays entirely in Orchestrator's
  // existing flow (see EntityLayer.svelte, which forwards both events,
  // and App.svelte, which turns them into Orchestrator's
  // `missionSubmit`/`deleteRequest` props).
  //
  // Marketing is shown to everyone on Listing/Mission records: the owner
  // sees it as "Marketing" next to Edit/Delete, everyone else sees the
  // same button labelled "Share". It is pure UI composition (a link
  // built from two plain fields already on the record), so it opens
  // locally with no event needed.
  //
  // First-time hints: the first time this device opens a post of its own,
  // a one-step spotlight tour explains the Marketing button; the first
  // time it opens someone else's post, one explains Share (see
  // onboarding/entitySteps.ts for the copy). Each is remembered in
  // localStorage — same pattern as HexMenu's OPERATOR_ACCEPT_KEY.
  //
  // Locking: while a workflow runs (`busy`) or this panel's own Save is
  // still waiting for its outcome (`saving`), every owner action — Edit,
  // Marketing, Delete and the whole edit form — is disabled. Close stays
  // available: it changes nothing and must never trap the person during a
  // long relay round trip.
  //
  // Location picking during Mission edit is delegated entirely to
  // hexmenu/Location.svelte (never getActiveViewer(), pickLocation.ts,
  // pickArea.ts, or route.ts directly, and never its own enable/disable
  // state machine) — same component SwarmGovernance's create form and
  // the HexMenu location flow all use. This panel still calls
  // cesium/api.ts directly for one thing Location.svelte deliberately
  // leaves to its caller: clearing a *confirmed* marker/rectangle at
  // this panel's own workflow-transition points (Change, Cancel,
  // Submit, Close) — see clearPickerPreview() below. While editing a
  // Mission, the backdrop is deliberately not rendered (see the
  // template below), so a click on the globe to pick a new Point/Area
  // reaches Cesium instead of just closing this panel.
  // -----------------------------------------------------------------------
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { ListingRecord, MissionRecord, MissionLocation } from '../orchestrator/appStore';
  import { pick } from './api';
  import Location from '../hexmenu/Location.svelte';
  import Marketing from '../shared/Marketing.svelte';
  import CloseButton from '../shared/CloseButton.svelte';
  import Onboarding from '../onboarding/Onboarding.svelte';
  import { ENTITY_OWNER_STEPS, ENTITY_VISITOR_STEPS } from '../onboarding/entitySteps';
  import type { OnboardingStep } from '../onboarding/steps';

  export let record: ListingRecord | MissionRecord | null = null;
  /** This client's own pubkey (from `$appStore.ownPubkey`) — compared against a listing's/mission's `author` to decide whether to show the owner-only actions below. */
  export let ownPubkey: string | null = null;
  /**
   * A workflow is currently running (`$appStore.inFlight`, passed down by
   * EntityLayer exactly like `ownPubkey` — this component still never
   * touches the store itself). Orchestrator refuses a second workflow anyway,
   * but refuses it *silently*; this is what keeps the person from getting
   * that far: every owner action below is disabled while it's true.
   */
  export let busy = false;

  const dispatch = createEventDispatcher();

  $: isOwner = !!record && !!ownPubkey && record.author === ownPubkey;

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
    // Wait for the panel's 0.18s slide-in to finish before dimming the
    // screen: the spotlight is measured once, and mid-animation the button
    // is still 12px off. It also lets the person see the panel first.
    const tourId = setTimeout(startOnboardingIfFirstTime, ONBOARDING_DELAY_MS);
    return () => {
      clearTimeout(id);
      clearTimeout(tourId);
    };
  });

  // ─── First-time spotlight tour (Marketing / Share) ──────────────────────
  const ONBOARDING_DELAY_MS = 350;
  const OWNER_TOUR_KEY = 'cloud-atlas-onboarding-entity-owner';
  const VISITOR_TOUR_KEY = 'cloud-atlas-onboarding-entity-visitor';

  let tourSteps: OnboardingStep[] | null = null;
  let tourKey = '';

  function startOnboardingIfFirstTime() {
    // `ownPubkey` still null = we can't tell whose post this is yet; showing
    // the wrong button's tour (and marking it seen) would be worse than
    // waiting for the next open. `locked` = the Marketing button is
    // disabled right now, don't spotlight a greyed-out button.
    if (!record || !ownPubkey || locked || editing || showMarketing) return;
    const key = isOwner ? OWNER_TOUR_KEY : VISITOR_TOUR_KEY;
    let seen = false;
    try { seen = localStorage.getItem(key) === 'true'; } catch {}
    if (seen) return;
    tourKey = key;
    tourSteps = isOwner ? ENTITY_OWNER_STEPS : ENTITY_VISITOR_STEPS;
  }

  function onTourClose(e: CustomEvent<{ completed: boolean }>) {
    // completed=false: the button wasn't found (nothing was shown) — try
    // again on the next open instead of burning the hint.
    if (e.detail.completed) {
      try { localStorage.setItem(tourKey, 'true'); } catch {}
    }
    tourSteps = null;
  }

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
  let locationPickerOpen = false;
  let pickerGeometry: 'point' | 'area' = 'point';

  function loadFormFrom(r: MissionRecord) {
    title = r.content.title;
    description = r.content.description;
    links = { ...r.content.lanes };
    pickedLocation = r.location;
  }

  // Re-hydrate the edit form only when the selected mission actually
  // changes (a different one, or Mission <-> non-Mission) — not on every
  // reference change of the same one, so an in-progress edit never gets
  // clobbered by e.g. a background store refresh of the same mission.
  // (startEdit() reloads it from the then-current record, so the form can
  // never start from an older copy either.)
  let hydratedId: string | null = null;
  $: if (record?.kind === 'mission' && record.id !== hydratedId) {
    loadFormFrom(record);
    editing = false;
    locationPickerOpen = false;
    hydratedId = record.id;
  } else if (record?.kind !== 'mission' && hydratedId !== null) {
    editing = false;
    locationPickerOpen = false;
    hydratedId = null;
  }

  // ─── Save / lock state ──────────────────────────────────────────────────
  //
  // Save no longer leaves edit mode on the spot (that showed the *old*
  // record until the publish had round-tripped through the relays, and lost
  // the input if it failed). It stays in the — now locked — form until the
  // outcome is known:
  //   • the record's eventId changed → the new version came back through the
  //     Store, `record` already carries it → leave edit mode;
  //   • the workflow ended without a new version (failed / aborted) → unlock
  //     and stay in the form with the input intact (the reason shows in
  //     Orchestrator's own status pill).
  let saving = false;
  let saveBaseEventId: string | null = null;
  let sawBusy = false;
  let saveGraceTimer: ReturnType<typeof setTimeout> | undefined;

  /** If no workflow ever starts (e.g. Orchestrator refused up front), don't stay locked forever. */
  const SAVE_START_GRACE_MS = 2000;

  $: locked = busy || saving;

  $: if (saving) {
    if (busy) sawBusy = true;

    if (record && record.eventId !== saveBaseEventId) {
      finishSave(true);
    } else if (sawBusy && !busy) {
      finishSave(false);
    }
  }

  function finishSave(success: boolean) {
    clearTimeout(saveGraceTimer);
    saving = false;
    sawBusy = false;
    if (success) editing = false;
  }

  onDestroy(() => clearTimeout(saveGraceTimer));

  $: formValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    links.brainstorming.trim().length > 0 &&
    pickedLocation !== null;

  // Not part of the picking session (that's entirely Location.svelte's
  // job now, delegated the same way SwarmGovernance.svelte does) — this
  // only wipes a *confirmed* marker/rectangle left on the globe once one
  // of this panel's own workflow transitions happens (Change, Cancel,
  // Submit, or the whole panel closing). Safe to call even if nothing
  // was ever picked or confirmed (pick.clear()/pick.area.clear() are
  // no-ops in that case).
  function clearPickerPreview(): void {
    pick.clear();
    pick.area.clear();
  }

  function openPicker(mode: 'point' | 'area') {
    pickerGeometry = mode;
    locationPickerOpen = true;
  }

  function onLocationConfirm(e) {
    const d = e.detail;
    if (d.geometry === 'point') {
      pickedLocation = { kind: 'point', latitude: d.point.latitude, longitude: d.point.longitude };
    } else if (d.geometry === 'area') {
      pickedLocation = { kind: 'area', ...d.area };
    }
    locationPickerOpen = false;
  }

  function onLocationCancel() {
    locationPickerOpen = false;
  }

  // Re-opens the picker for the same geometry instead of just clearing
  // to null: cesium/api.ts's pick.enable()/pick.area.enable() already
  // disable+clear whichever picker was previously active before
  // starting a new one, so the stale marker/rectangle from the
  // confirmed pick is removed the instant Location.svelte re-mounts and
  // calls enable() again — no separate cleanup call needed here.
  function changeLocation() {
    if (!pickedLocation) return;
    pickerGeometry = pickedLocation.kind;
    pickedLocation = null;
    locationPickerOpen = true;
  }

  function startEdit() {
    if (locked || !record || record.kind !== 'mission') return;
    loadFormFrom(record);
    editing = true;
  }

  function cancelEdit() {
    if (locked || !record || record.kind !== 'mission') return;
    clearPickerPreview();
    locationPickerOpen = false;
    loadFormFrom(record);
    editing = false;
  }

  function handleMissionSubmit() {
    if (locked || !record || record.kind !== 'mission' || !formValid || !pickedLocation) return;

    clearPickerPreview();

    saveBaseEventId = record.eventId;
    sawBusy = false;
    saving = true;

    clearTimeout(saveGraceTimer);
    saveGraceTimer = setTimeout(() => {
      if (saving && !sawBusy) finishSave(false);
    }, SAVE_START_GRACE_MS);

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
    // Deliberately no `editing = false` here — see "Save / lock state" above.
  }

  // ─── Shared actions ─────────────────────────────────────────────────────

  function close() {
    clearPickerPreview();
    locationPickerOpen = false;
    dispatch('close');
  }

  function requestDelete() {
    if (locked || !record) return;
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

  function titleOf(r: ListingRecord | MissionRecord): string {
    if (r.kind === 'mission') return r.content.title || 'Mission';
    const content = r.content as Record<string, unknown>;
    if (typeof content?.title === 'string' && content.title) return content.title;
    return humanize(r.model);
  }

  function categoryOf(r: ListingRecord | MissionRecord): string | null {
    if (r.kind === 'mission') return null;
    const content = r.content as Record<string, unknown>;
    if (typeof content?.categoryId === 'string') return humanize(content.categoryId);
    if (Array.isArray(content?.categoryIds) && content.categoryIds.length) {
      return (content.categoryIds as string[]).map(humanize).join(', ');
    }
    return null;
  }

  function fieldOf(r: ListingRecord | MissionRecord, key: string): string | null {
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

</script>

<svelte:window on:keydown={onKeydown} />

{#if record}
  {#if !(record.kind === 'mission' && editing)}
    <div class="backdrop" on:click={() => canCloseOnBackdrop && close()} />
  {/if}

  <div class="panel" class:picker-open={locationPickerOpen} role="dialog" aria-modal="true">
    <div class="panel-header">
      <span class="kind-badge" class:mission={record.kind === 'mission'}>
        {record.kind === 'mission' ? 'MISSION' : 'LISTING'}
      </span>
      <CloseButton onClose={close} position="relative" top="0" right="0" />
    </div>

    <div class="scroll">
      {#if record.kind === 'mission' && editing}
        <!-- ─── Mission edit form ─────────────────────────────────────── -->
        <form on:submit|preventDefault={handleMissionSubmit}>
          <!-- A disabled fieldset disables every input/button inside it at once. -->
          <fieldset class="mf-lock" disabled={locked}>
            <div class="mf">
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
                  <button type="button" class="mf-location-change" on:click={changeLocation}>
                    Change
                  </button>
                </div>
              {:else if !locationPickerOpen}
                <div class="mf-location-buttons">
                  <button
                    type="button"
                    class="mf-location-btn"
                    on:click={() => openPicker('point')}
                  >
                    Pick Point
                  </button>

                  <button
                    type="button"
                    class="mf-location-btn"
                    on:click={() => openPicker('area')}
                  >
                    Pick Area
                  </button>
                </div>
              {/if}

              <div class="mf-actions">
                <button type="button" class="mf-cancel" on:click={cancelEdit}>
                  Cancel
                </button>
                <button type="submit" class="mf-submit" disabled={!formValid}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>

        {#if locationPickerOpen}
          <Location
            geometry={pickerGeometry}
            on:confirm={onLocationConfirm}
            on:cancel={onLocationCancel}
          />
        {/if}
      {:else}
        <!-- ─── Read-only record view ─────────────────────────────────── -->
        <h2 class="title">{titleOf(record)}</h2>

        {#if record.kind !== 'mission'}
          <div class="model">{record.model.replace(/_/g, ' ')}</div>
        {/if}

        {#if record.kind === 'listing'}
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
              <button class="owner-btn edit" disabled={locked} on:click={startEdit}>Edit</button>
            {/if}
            <button class="owner-btn marketing" data-onboarding="entity-marketing" disabled={locked} on:click={() => (showMarketing = true)}>Marketing</button>
            <button class="owner-btn delete" disabled={locked} on:click={requestDelete}>Delete</button>
          </div>
        {:else}
          <!-- Non-owner: same Marketing panel, just labelled "Share". -->
          <div class="owner-actions">
            <button class="owner-btn marketing" data-onboarding="entity-share" on:click={() => (showMarketing = true)}>Share</button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if tourSteps}
    <Onboarding steps={tourSteps} on:close={onTourClose} />
  {/if}
{/if}

{#if showMarketing && record}
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
      left: 4vw;
      transform: translateY(-50%);

      width: min(640px, 44vw);
      max-height: 88vh;
      box-sizing: border-box;

      /* Column: header stays put, only .scroll scrolls. */
      display: flex;
      flex-direction: column;
      overflow: hidden;

      background: var(--accent-stripe), var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: var(--glass-border);
      border-radius: var(--glass-radius);

    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    z-index: 41;
  }

  /*
   * Hidden (not unmounted) while Location.svelte is open — same
   * reasoning as SwarmGovernance.svelte's .mission-card.picker-open:
   * visibility, not display:none, form state is plain component state
   * either way, and Location.svelte's own DOM lives in document.body
   * via its portal action so this never hides it too.
   */
  .panel.picker-open {
    visibility: hidden;
  }

  /* Pinned: kind badge + CloseButton never scroll away. */
  .panel-header {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2.5rem 1.5rem 0.75em;
  }

  /* Only this area scrolls — the CloseButton (child of .panel) stays put. */
  .scroll {
    flex: 1 1 auto;
    min-height: 0; /* required, otherwise a flex child cannot scroll */
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 0 1.5rem 1.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
  }

  .scroll::-webkit-scrollbar {
    width: 6px;
  }

  .scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.28);
    border-radius: 3px;
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

  .owner-btn:disabled {
    opacity: 0.4;
    pointer-events: none;
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

  /* Wrapper only: the fieldset exists to disable its whole subtree at once. */
  .mf-lock {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  /* pointer-events: none also suppresses the hover highlights of the buttons inside. */
  .mf-lock:disabled {
    opacity: 0.55;
    pointer-events: none;
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

  /* Two columns, same lane grid SwarmGovernance's create form uses.
     minmax(0, 1fr) lets the inputs shrink instead of overflowing the
     panel; min-width: 0 on .mf-lane does the same for the flex child. */
  .mf-lanes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.75rem;
    row-gap: 0.35rem;
  }

  .mf-lane {
    display: flex;
    flex-direction: column;
    min-width: 0;
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
        top: 0;
        left: 5px;
        transform: none;

        width: 100%;
        max-height: 50vh;

        box-sizing: border-box;
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
