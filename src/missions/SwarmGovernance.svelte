<script lang="ts">
  // missions/SwarmGovernance.svelte
  // -----------------------------------------------------------------------
  // Mission 2 in the HexMenu creation flow — new-mission form only.
  //
  // Viewing/editing an *existing* mission is EntityDetails.svelte's job
  // now (see cesium/EntityDetails.svelte's Mission Edit section) — this
  // component no longer has a `record` prop, no read-only/owner mode, no
  // Marketing/Delete. It renders its own chrome (`.panel`, own
  // CloseButton) — same pattern EntityDetails.svelte uses for itself,
  // and Mission1.svelte/Omnipedia.svelte each do independently too.
  // HexMenu just decides *whether* to mount it (missionModal===2) and
  // reacts to its `submit`/`close` events; it owns none of this
  // component's chrome or CSS.
  //
  // Still primarily UI: it renders the form and delegates the actual
  // Point/Area picking *session* entirely to hexmenu/Location.svelte
  // (never talks to pickLocation.ts/pickArea.ts/route.ts directly, and
  // never runs its own enable/disable state machine — Location.svelte
  // is now the single place that owns that, plus the zoom-required
  // gate, same component the HexMenu location flow and
  // EntityDetails.svelte's Mission edit form both use). It still calls
  // cesium/api.ts directly for one thing Location.svelte deliberately
  // leaves to its caller: clearing the *confirmed* marker/rectangle
  // once this form's workflow ends (submit, or the form closing
  // unsubmitted) — see Location.svelte's own onDestroy comment for why
  // that's the caller's job, not the picker's. Builds the mission
  // payload and dispatches `submit` — no direct Nostr communication
  // here. The actual publish stays entirely in Orchestrator's existing
  // flow (App.svelte -> missionSubmit prop).
  // -----------------------------------------------------------------------

  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { pick } from '../cesium/api';
  import Location from '../hexmenu/Location.svelte';
  import CloseButton from '../shared/CloseButton.svelte';
  import Onboarding from '../onboarding/Onboarding.svelte';
  import { MISSION2_STEPS } from '../onboarding/missionSteps';
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

  // Not part of the picking session (that's entirely Location.svelte's
  // job now) — this only wipes a *confirmed* marker/rectangle left on
  // the globe once this component's own workflow ends, either by a
  // successful submit or by the whole form being closed/destroyed
  // without submitting. Safe to call even if nothing was ever picked or
  // confirmed (pick.clear()/pick.area.clear() are no-ops in that case).
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
  // The picking *session* itself is delegated entirely to Location.svelte,
  // mounted below only while locationPickerOpen is true — no pickingMode,
  // no enable/disable state machine here anymore (see clearPickerPreview()
  // above for the one direct pick.* use that remains: end-of-workflow
  // cleanup, not picking).

  let locationPickerOpen = false;
  let pickerGeometry: 'point' | 'area' = 'point';

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

  // "Change" re-opens the picker for the same geometry instead of just
  // clearing to null: cesium/api.ts's pick.enable()/pick.area.enable()
  // already disable+clear whichever picker was previously active before
  // starting a new one, so the stale marker/rectangle from the
  // confirmed pick is removed the instant Location.svelte re-mounts and
  // calls enable() again — no separate cleanup call needed here.
  function changeLocation() {
    if (!pickedLocation) return;
    pickerGeometry = pickedLocation.kind;
    pickedLocation = null;
    locationPickerOpen = true;
  }

  // Own CloseButton now (previously HexMenu's, on .mission-modal-content)
  // — just needs to signal the parent to unmount this component.
  // onDestroy below already handles the actual cleanup that follows.
  function close() {
    dispatch('close');
  }

  // Covers this component being closed/destroyed *without* submitting
  // (via the CloseButton above, or however the parent ends up unmounting
  // it) while a location was already confirmed — handleSubmit's
  // clearPickerPreview() only runs on the submit path, so this is the
  // other place a confirmed marker/rectangle needs to be wiped. If
  // Location.svelte itself is still mounted (locationPickerOpen) when
  // this fires, Svelte destroys it first, which already disables/clears
  // its own in-progress preview — this call only concerns the separate,
  // already-confirmed marker.
  onDestroy(clearPickerPreview);

  // ─── First-time spotlight tour ───
  // Shown the first time this form is opened on this device, remembered in
  // localStorage — same pattern as HexMenu's OPERATOR_ACCEPT_KEY. Copy in
  // onboarding/missionSteps.ts; the targets are the `data-onboarding`
  // attributes below. The short delay lets the person see the form before
  // the screen dims.
  const TOUR_KEY = 'cloud-atlas-onboarding-mission2';
  const TOUR_DELAY_MS = 350;
  let tourOpen = false;

  onMount(() => {
    const id = setTimeout(() => {
      let seen = false;
      try { seen = localStorage.getItem(TOUR_KEY) === 'true'; } catch {}
      if (!seen) tourOpen = true;
    }, TOUR_DELAY_MS);
    return () => clearTimeout(id);
  });

  function onTourClose(e: CustomEvent<{ completed: boolean }>) {
    // completed=false: no target was found, nothing was shown — try again next time.
    if (e.detail.completed) {
      try { localStorage.setItem(TOUR_KEY, 'true'); } catch {}
    }
    tourOpen = false;
  }
</script>

<div class="panel" class:picker-open={locationPickerOpen}>
  <CloseButton onClose={close} />

  <div class="scroll">
    <form class="mf" on:submit|preventDefault={handleSubmit}>
      <h2 class="mf-heading">Swarm Governance</h2>

      <label class="mf-label" for="mf-title">Title</label>
      <input
        id="mf-title"
        data-onboarding="m2-title"
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

      <div class="mf-lanes" data-onboarding="m2-lanes">
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
            on:click={changeLocation}
          >
            Change
          </button>
        </div>
      {:else if !locationPickerOpen}
        <div class="mf-location-buttons" data-onboarding="m2-location">
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
        <button type="submit" class="mf-submit" data-onboarding="m2-submit" disabled={!formValid}>
          Submit
        </button>
      </div>
    </form>
  </div>

  {#if locationPickerOpen}
    <Location
      geometry={pickerGeometry}
      on:confirm={onLocationConfirm}
      on:cancel={onLocationCancel}
    />
  {/if}
</div>

{#if tourOpen}
  <Onboarding steps={MISSION2_STEPS} align="left" on:close={onTourClose} />
{/if}

<style>
  .panel {
    position: fixed;
    top: 50%;
    left: 4vw;
    transform: translateY(-50%);

    width: min(640px, 44vw);
    max-height: 88vh;
    box-sizing: border-box;

    /* Column: only .scroll scrolls, the CloseButton stays put. */
    display: flex;
    flex-direction: column;
    overflow: hidden;

    background: var(--accent-stripe), var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);

    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

    color: #eee;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    z-index: 9999;
  }

  /*
   * Hidden (not unmounted) while Location.svelte is open — visibility,
   * not display:none, so form state (title/description/links/
   * pickedLocation, all plain component state, not DOM state) survives
   * regardless either way. Location.svelte's own DOM lives in
   * document.body via its portal action, so this never hides it too.
   */
  .panel.picker-open {
    visibility: hidden;
  }

  @media (max-width: 700px) {
    .panel {
        position: fixed;
        inset: 0;

        width: 100%;
        height: 100dvh;
        max-height: none;

        transform: none;

        border-radius: var(--glass-radius);

        overflow: hidden;
        box-sizing: border-box;
    }
  }

  /* Only this area scrolls — the CloseButton (child of .panel) stays put. */
  .scroll {
    flex: 1 1 auto;
    min-height: 0; /* required, otherwise a flex child cannot scroll */
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 2.5rem 1.5rem 1.5rem;
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
