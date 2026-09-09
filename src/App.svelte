<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";
  import EntityLayer from "./cesium/EntityLayer.svelte";
  import Orchestrator from "./Orchestrator.svelte";
  import ProgressBar from "./shared/ProgressBar.svelte";

  import { appStore } from "./orchestrator/appStore";

  let tooltip = null;

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

  // Owner-initiated deletion (cesium/EntityDetails.svelte's Delete button)
  // bubbles up through EntityLayer as a plain `delete` event, exactly like
  // HexMenu's submit events — captured here as reactive state and passed
  // straight down to Orchestrator, never forwarded as a direct call.
  let deleteRequest: { id: string } | null = null;

  function handleDeleteRequest(e) {
    deleteRequest = { id: e.detail.id };
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

  function updateLayout() {
    if (!workspaceEl) return;
    const ws = workspaceEl.getBoundingClientRect();
    landscape = ws.width >= ws.height;
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(workspaceEl);
    updateLayout();

    deepLink = parseDeepLinkPath(window.location.pathname);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<div class="workspace" bind:this={workspaceEl}>

  <div class="background-layer">
    <HexMenu
      on:tooltip={(e) => (tooltip = e.detail)}
      on:offerSubmit={handleOfferSubmit}
      on:searchSubmit={handleSearchSubmit}
      on:interaction={handleHexMenuInteraction}
    />
  </div>

  <div
    class="globe-window"
    class:landscape={landscape}
    class:portrait={!landscape}
  >
    <div class="cesium-layer">
      <Cesium />
    </div>

    <ProgressBar />

    <EntityLayer {deepLink} on:delete={handleDeleteRequest} />

    <OverlayLayer {tooltip} />
  </div>

  <Orchestrator {submit} {deleteRequest} openEventId={deepLink?.eventId ?? null} />

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

.workspace {
  position: fixed;
  inset: 0;
}

.background-layer {
  position: absolute;
  inset: 0;
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

.cesium-layer {
  width: 100%;
  height: 100%;
}
</style>
