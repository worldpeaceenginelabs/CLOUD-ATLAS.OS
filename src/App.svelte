<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";
  import EntityLayer from "./cesium/EntityLayer.svelte";
  import Orchestrator from "./Orchestrator.svelte";
  import ProgressBar from "./shared/ProgressBar.svelte";

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

    requestAnimationFrame(() => {
      setupWorkspaceObserver();
    });
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

    <button class="workspace-toggle" on:click={toggleWorkspace}>
      {fullGlobe ? 'Split View' : 'Fullscreen'}
    </button>

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

  .workspace-toggle {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 30;
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
