<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";
  import EntityLayer from "./cesium/EntityLayer.svelte";
  import Orchestrator from "./Orchestrator.svelte";
  import MissionTV from "./missions/MissionTV.svelte";
  import About from "./shared/About.svelte";
  import ProgressBar from "./shared/ProgressBar.svelte";
  import Onboarding from "./onboarding/Onboarding.svelte";

  import {
    appStore,
    type MissionLocation,
    type MissionLanes
  } from "./orchestrator/appStore";

  let tooltip = null;

  let showPicture = true;

  const quote =
    '"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete." Buckminster Fuller';

  function enterApp() {
    showPicture = false;

    startOnboardingIfFirstRun();

    requestAnimationFrame(() => {
      setupWorkspaceObserver();
    });
  }

  // First-run spotlight tour (onboarding/Onboarding.svelte). Same contract as
  // About / MissionTV — App.svelte only knows whether it's open; the
  // component owns its chrome and dispatches `close`. "Los geht's" and
  // "Überspringen" both close it, and both count as "seen": one persisted
  // boolean, same pattern as HexMenu's OPERATOR_ACCEPT_KEY (no store).
  //
  // Not shown on a deep link (/move/abc123): that person came for one
  // specific listing, and the tour would sit right on top of it. They get
  // the tour on their next regular visit.
  const ONBOARDING_KEY = 'cloud-atlas-onboarding-done';
  let onboardingOpen = false;

  function startOnboardingIfFirstRun() {
    if (deepLink) return;
    let seen = false;
    try { seen = localStorage.getItem(ONBOARDING_KEY) === 'true'; } catch {}
    if (!seen) onboardingOpen = true;
  }

  function closeOnboarding() {
    onboardingOpen = false;
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch {}
  }

  // Web deep link (§4-§8 of the marketing/delete instruction): parsed
  // once on mount from the current URL, e.g. /move/abc123 ->
  // { domain: 'move', eventId: 'abc123' } — `domain` here is a real
  // Cloud Atlas domain (move, goods, food, skills, ...), never "listing"
  // (that's an operating mode, LIVE/LISTING, not a domain). This is the
  // only URL handling in the app — no router. An unrecognized path just
  // leaves `deepLink` null and the app behaves exactly as it always did.
  let deepLink: { domain: string; eventId: string } | null = null;

  function parseDeepLinkPath(pathname: string): { domain: string; eventId: string } | null {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return null;
    const [domain, eventId] = parts;
    if (!domain || !eventId) return null;
    return { domain, eventId };
  }

  // Owner-initiated deletion (cesium/EntityDetails.svelte's or missions/
  // SwarmGovernance.svelte's Delete button) bubbles up through EntityLayer
  // as a plain `delete` event carrying the full record — exactly like
  // HexMenu's submit events — captured here as reactive state and passed
  // straight down to Orchestrator, never forwarded as a direct call.
  // `kind` picks which of the two (otherwise identical) tombstone flows
  // applies; it's already on the record, no extra lookup needed.
  let deleteRequest: { id: string; kind: 'listing' | 'mission' } | null = null;

  function handleDeleteRequest(e) {
    deleteRequest = { id: e.detail.id, kind: e.detail.kind };
  }

  // A newly created or edited mission (missions/SwarmGovernance.svelte's
  // Submit/Save) reaches here from two different places — HexMenu's own
  // "new mission" modal (missionSubmit) and EntityLayer's "existing
  // mission" card (also missionSubmit, forwarded the same way) — both
  // just set the same reactive state and pass it down, same pattern as
  // everything else in this file.
  let missionSubmit: {
    dTag?: string;
    title: string;
    description: string;
    location: MissionLocation;
    lanes: MissionLanes;
  } | null = null;

  function handleMissionSubmit(e) {
    missionSubmit = e.detail;
  }

  // Orchestrator is mounted persistently (it owns a standing relay
  // connection, the tombstone watcher and any in-progress LIVE session —
  // none of that should restart on every submit). New work reaches it
  // purely as a prop: HexMenu's submit events only bubble to their direct
  // parent (this component), so they're captured here as plain reactive
  // state and passed straight down — no event forwarding, no bind:this,
  // no controller layer.
  let submit: { payload: { tags: string[][]; content: string }; action: "offer" | "search" } | null = null;

  function handleOfferSubmit(e) {
    submit = { payload: e.detail, action: "offer" };
  }

  function handleSearchSubmit(e) {
    submit = { payload: e.detail, action: "search" };
  }

  function handleHexMenuInteraction() {
    appStore.update((s) => ({ ...s, lastError: null }));
  }

  let workspaceEl;
  let resizeObserver;
  let landscape = true;

  // Toggle Workspace: switches between the existing 50/50 landscape/
  // portrait split and a 100% globe view. Plain local boolean, no store —
  // the existing landscape/portrait logic above is untouched and simply
  // gets overridden by the .fullscreen class when this is true.
  let fullGlobe = false;

  function toggleWorkspace() {
    fullGlobe = !fullGlobe;
  }

  // MissionTV: App.svelte only knows whether it's open. The component owns
  // its own chrome (.panel + CloseButton) and dispatches `close` — same
  // contract as the mission components HexMenu mounts (Omnipedia etc.).
  let missionTVOpen = false;

  // About: same contract as MissionTV — App.svelte only knows whether it's
  // open; the component owns its chrome and dispatches `close`.
  let aboutOpen = false;

  function updateLayout() {
    if (!workspaceEl) return;
    const ws = workspaceEl.getBoundingClientRect();
    landscape = ws.width >= ws.height;
  }

  function setupWorkspaceObserver() {
    if (!workspaceEl) return;

    resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(workspaceEl);
    updateLayout();
  }

  onMount(() => {
    deepLink = parseDeepLinkPath(window.location.pathname);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<div class="app-container">
{#if showPicture}
  <div class="picture-container" on:click={enterApp}>
    <video
      autoplay
      loop
      muted
      playsinline
      poster="./cloudatlas8kzip.jpg"
      class="picture"
    >
      <source src="./cloudatlas8kzip.mp4" type="video/mp4" />
    </video>

    <div class="overlay"></div>

    <div class="quote">{quote}</div>

    <div class="enter-text animated-gradient">ENTER</div>

    <div class="twpg-text under-enter animated-gradient">
      THE WORLD PEACE GAME
    </div>
  </div>
{:else}
  <div class="workspace" bind:this={workspaceEl}>

    <div class="background-layer" class:hidden={fullGlobe}>
      <HexMenu
        on:tooltip={(e) => (tooltip = e.detail)}
        on:offerSubmit={handleOfferSubmit}
        on:searchSubmit={handleSearchSubmit}
        on:interaction={handleHexMenuInteraction}
        on:missionSubmit={handleMissionSubmit}
      />
    </div>

    <div
      class="globe-window"
      class:landscape={landscape}
      class:portrait={!landscape}
      class:fullscreen={fullGlobe}
    >
      <div class="cesium-layer">
        <Cesium />
      </div>

      <ProgressBar />
      <EntityLayer
        {deepLink}
        on:delete={handleDeleteRequest}
        on:missionSubmit={handleMissionSubmit}
      />

      <OverlayLayer {tooltip} />
    </div>

    <Orchestrator
      {submit}
      {deleteRequest}
      {missionSubmit}
      openEventId={deepLink?.eventId ?? null}
    />

    <button class="corner-btn mission-tv-btn" on:click={() => (missionTVOpen = true)} title="MissionTV">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
      </svg>
    </button>

    {#if missionTVOpen}
      <MissionTV on:close={() => (missionTVOpen = false)} />
    {/if}

    <button class="corner-btn about-btn" on:click={() => (aboutOpen = true)} title="About">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </button>

    {#if aboutOpen}
      <About on:close={() => (aboutOpen = false)} />
    {/if}

    <button class="corner-btn workspace-toggle" on:click={toggleWorkspace}>
      {fullGlobe ? 'Split View' : 'Fullscreen'}
    </button>

    {#if onboardingOpen}
      <Onboarding on:close={closeOnboarding} />
    {/if}

  </div>
{/if}
</div>

<style>
  :global(html),
  :global(body),
  :global(#app) {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .app-container {
    height: 100dvh;
    width: 100vw;
    box-sizing: border-box;
  }

  .workspace {
    position: fixed;
    inset: 0;

    /* Distance of every corner button (MissionTV top right, About bottom
       left, Fullscreen/Split View bottom right) from the screen edge. The
       top/bottom edges add their safe-area inset on top of it. */
    --edge-gap: 10px;
  }

  .background-layer {
    position: absolute;
    inset: 0;
  }

  .background-layer.hidden {
    visibility: hidden;
    pointer-events: none;
  }

  .background-layer > :global(*) {
    width: 100%;
    height: 100%;
  }

  .globe-window {
    position: absolute;
    z-index: 20;
  }

  .globe-window.landscape {
    top: 0;
    right: 0;
    width: 50%;
    height: 100%;
  }

  .globe-window.portrait {
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 50%;
  }

  .globe-window.fullscreen {
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }

  .cesium-layer {
    width: 100%;
    height: 100%;
  }

  /* Round-cornered glass buttons (MissionTV, About, Fullscreen/Split View)
     — look only, position comes from the per-button rules below */
  .corner-btn {
    position: absolute;
    z-index: 1000;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .corner-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  /* MissionTV button (top right) */
  .mission-tv-btn {
    top: calc(var(--edge-gap) + env(safe-area-inset-top, 0px));
    right: var(--edge-gap);
  }

  /* About button (bottom left) */
  .about-btn {
    bottom: calc(var(--edge-gap) + env(safe-area-inset-bottom, 0px));
    left: var(--edge-gap);
  }

  /* Fullscreen / Split View button (bottom right) — the only one with a
     text label, so it keeps the 40px height but sizes its width to the text */
  .workspace-toggle {
    bottom: calc(var(--edge-gap) + env(safe-area-inset-bottom, 0px));
    right: var(--edge-gap);
    width: auto;
    padding: 0 14px;
    font: inherit;
    font-size: 14px;
    white-space: nowrap;
  }

  /* ---------------------------------------------------------------------- */
  /* Startup screen                                                         */
  /* ---------------------------------------------------------------------- */

  .picture-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
    background-color: #000;
    height: 100dvh;
    width: 100vw;
    position: relative;
    overflow: hidden;
  }

  .picture {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    cursor: pointer;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.2),
      rgba(0, 0, 0, 0.7)
    );
    z-index: 2;
    pointer-events: none;
  }

  .quote {
    margin-top: 2em;
    font-size: 1.5em;
    font-style: italic;
    color: white;
    z-index: 3;
    max-width: 90%;
  }

  .enter-text {
    position: absolute;
    top: 33%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    text-align: center;
    font-size: 30vw;
    line-height: 1.2;
    cursor: pointer;
    z-index: 4;
    pointer-events: none;
  }

  .twpg-text.under-enter {
    position: absolute;
    top: calc(33% + 18vw);
    left: 50%;
    transform: translateX(-50%);
    font-size: 4.3vw;
    width: fit-content;
    max-width: 100%;
    z-index: 4;
    pointer-events: none;
  }

  .animated-gradient {
    background: linear-gradient(
      -45deg,
      #ee7752,
      #e73c7e,
      #23a6d5,
      #23d5ab
    );
    background-size: 400% 400%;
    animation:
      gradientBG 5s ease infinite,
      pulse 10s infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }

    50% {
      opacity: 0;
    }

    100% {
      opacity: 1;
    }
  }

  @keyframes gradientBG {
    0% {
      background-position: 0% 50%;
    }

    50% {
      background-position: 100% 50%;
    }

    100% {
      background-position: 0% 50%;
    }
  }

  /* Mobile Layout */
  @media (max-width: 768px) {
    .picture-container {
      background: black;
      justify-content: center;
      align-items: center;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .picture {
      object-fit: contain;
      background-color: rgba(255, 255, 255, 0.97);
    }

    .quote {
      color: black;
      position: absolute;
      bottom: calc(10% + env(safe-area-inset-bottom, 0px));
      font-size: 1.1em;
      padding: 0 1em;
      text-align: center;
      max-width: 90%;
      z-index: 3;
    }

    .enter-text {
      position: relative;
      top: auto;
      left: auto;
      transform: none;
      font-size: 30vw;
    }

    .twpg-text.under-enter {
      position: relative;
      top: auto;
      left: auto;
      transform: none;
      font-size: 7vw;
    }
  }

  /* Very small screens (under 400px) */
  @media (max-width: 400px) {
    .quote {
      font-size: 1em;
    }
  }
</style>
