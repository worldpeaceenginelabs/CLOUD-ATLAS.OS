<script lang="ts">
  import { slide } from 'svelte/transition';
  import LocationPicker from '../components/LocationPicker.svelte';
  import { verticalIconSvg } from '../gig/verticalIcons';
  import type { GigVertical, SwarmMissionCardPayload, SwarmMissionLane, SwarmMissionState } from '../types';
  import { openExternal } from '../utils/openExternal';
  import { ensureProtocol } from '../utils/urlUtils';
  import { createEmptySwarmMissionState } from '../utils/swarmMission';

  export let mission: SwarmMissionCardPayload | null = null;
  export let viewerPubkey: string = '';
  export let accentColor: string = '#7E57C2';
  export let onCommit: ((data: SwarmMissionCardPayload) => void | Promise<void>) | undefined = undefined;
  export let onDelete: ((id: string) => void | Promise<void>) | undefined = undefined;
  const LANE_META: {
    lane: SwarmMissionLane;
    label: string;
    iconVertical: GigVertical;
    color: string;
  }[] = [
    { lane: 'brainstorming', label: 'Brainstorm', iconVertical: 'brainstorming', color: '#FFCA28' },
    { lane: 'meetanddo', label: 'Meet & do', iconVertical: 'meetanddo', color: '#66BB6A' },
    { lane: 'petition', label: 'Petition', iconVertical: 'petition', color: '#AB47BC' },
    { lane: 'crowdfunding', label: 'Fund', iconVertical: 'crowdfunding', color: '#EF5350' },
  ];

  let localId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `local-${Date.now()}`;
  let title = '';
  let description = '';
  let swarm: SwarmMissionState = createEmptySwarmMissionState();
  let locationLat = '';
  let locationLon = '';
  let locationAddress = '';

  let editing = false;
  let saving = false;
  let deleting = false;
  let focusedLane: SwarmMissionLane | null = null;
  let hydratedMissionKey: string | null = null;

  $: published = mission !== null;
  $: authorPubkey = mission?.authorPubkey ?? viewerPubkey;
  $: isAuthor = viewerPubkey !== '' && viewerPubkey === authorPubkey;
  $: canUseEdit = published && isAuthor;
  $: if (!published) editing = true;

  $: {
    const missionKey = mission ? `${mission.id}:${mission.timestamp ?? ''}` : null;
    if (missionKey !== hydratedMissionKey) {
      hydratedMissionKey = missionKey;
      if (mission) {
        localId = mission.id;
        title = mission.title;
        description = mission.description;
        swarm = {
          links: { ...mission.swarm.links },
        };
        locationLat = mission.locationLat ?? '';
        locationLon = mission.locationLon ?? '';
        locationAddress = mission.address ?? '';
        editing = false;
        focusedLane = null;
      } else {
        localId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `local-${Date.now()}`;
        title = '';
        description = '';
        swarm = createEmptySwarmMissionState();
        locationLat = '';
        locationLon = '';
        locationAddress = '';
        editing = true;
        focusedLane = null;
      }
    }
  }

  function laneLit(lane: SwarmMissionLane): boolean {
    return !!swarm.links[lane]?.trim();
  }

  function whatsNextLine(): string {
    const parts: string[] = [];
    const open = (lane: SwarmMissionLane): boolean => !!swarm.links[lane]?.trim();
    if (open('brainstorming')) parts.push('Brainstorming is open — join via the link.');
    if (open('meetanddo')) parts.push('On-site / coordination is linked — use Meet & do.');
    if (open('petition')) parts.push('Petition is open — sign via the link.');
    if (open('crowdfunding')) parts.push('Funding is open — contribute via the link.');
    if (parts.length === 0) {
      if (!published) {
        return 'Publish with a brainstorm link first. After publish, you can add Meet & do, petition, and/or funding links.';
      }
      return 'No open lanes right now — thanks to everyone who participated.';
    }
    return parts.join(' ');
  }

  function handleLocationSelected(lat: string, lon: string, displayName?: string) {
    locationLat = lat;
    locationLon = lon;
    if (displayName) locationAddress = displayName;
  }

  function openLaneLink(lane: SwarmMissionLane) {
    const u = swarm.links[lane]?.trim();
    if (!u) return;
    void openExternal(ensureProtocol(u));
  }

  function onLaneGlyphClick(lane: SwarmMissionLane) {
    if (editing) {
      focusedLane = focusedLane === lane ? null : lane;
      return;
    }
    if (laneLit(lane)) openLaneLink(lane);
  }

  function linkEditable(lane: SwarmMissionLane): boolean {
    if (!editing) return false;
    if (lane === 'brainstorming') return true;
    return published;
  }

  function missionDraftValid(requirePublished: boolean): boolean {
    if (requirePublished && !published) return false;
    return (
      title.trim().length > 0 &&
      description.trim().length > 0 &&
      swarm.links.brainstorming.trim().length > 0 &&
      locationLat.trim().length > 0 &&
      locationLon.trim().length > 0
    );
  }

  $: firstPublishValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    swarm.links.brainstorming.trim().length > 0 &&
    locationLat.trim().length > 0 &&
    locationLon.trim().length > 0;
  $: updateValid =
    published &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    swarm.links.brainstorming.trim().length > 0 &&
    locationLat.trim().length > 0 &&
    locationLon.trim().length > 0;

  function buildPayload(): SwarmMissionCardPayload {
    return {
      id: localId,
      authorPubkey,
      title: title.trim(),
      description: description.trim(),
      address: locationAddress || undefined,
      locationLat: locationLat || undefined,
      locationLon: locationLon || undefined,
      timestamp: undefined,
      swarm: {
        links: {
          brainstorming: swarm.links.brainstorming.trim(),
          meetanddo: swarm.links.meetanddo.trim(),
          petition: swarm.links.petition.trim(),
          crowdfunding: swarm.links.crowdfunding.trim(),
        },
      },
    };
  }

  async function handleCommit() {
    if (!onCommit) return;
    if (!published && !firstPublishValid) return;
    if (published && !updateValid) return;
    saving = true;
    try {
      await onCommit(buildPayload());
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!onDelete || !published) return;
    deleting = true;
    try {
      await onDelete(localId);
    } finally {
      deleting = false;
    }
  }

  function toggleEditing() {
    if (!canUseEdit) return;
    editing = !editing;
    if (!editing) focusedLane = null;
  }
</script>

<div class="mission-card" style="--accent: {accentColor}">
  <div class="mc-row mc-title-row">
    {#if editing}
      <label class="mc-label" for="mc-title">Title</label>
      <input id="mc-title" class="mc-input" type="text" maxlength={200} placeholder="Mission title" bind:value={title} />
    {:else}
      <h2 class="mc-title">{title || 'Untitled mission'}</h2>
    {/if}
  </div>

  <div class="mc-row mc-lanes" transition:slide={{ duration: 200 }}>
    {#each LANE_META as { lane, label, iconVertical, color }}
      <div class="mc-lane" class:mc-lane-focus={focusedLane === lane}>
        <button
          type="button"
          class="mc-lane-glyph"
          class:mc-lane-dim={!laneLit(lane)}
          style="--lane-color: {color}"
          title={editing ? `Set ${label} link` : laneLit(lane) ? `Open ${label}` : `No ${label} link`}
          on:click={() => onLaneGlyphClick(lane)}
        >
          <span class="mc-lane-icon" class:mc-grey={!laneLit(lane)}>
            {@html verticalIconSvg(iconVertical, 28)}
          </span>
        </button>
        <span class="mc-lane-label">{label}</span>
        {#if editing && linkEditable(lane)}
          <input
            class="mc-link-input"
            type="url"
            inputmode="url"
            placeholder={lane === 'brainstorming' ? 'Brainstorm link (required to publish)' : 'https://…'}
            bind:value={swarm.links[lane]}
          />
        {/if}
      </div>
    {/each}
  </div>

  {#if editing && !published}
    <p class="mc-hint">
      Only the brainstorm link is available until you publish. After publish, you can add Meet & do, petition, and/or funding links.
    </p>
  {/if}

  <div class="mc-row mc-next">
    <span class="mc-next-label">What’s next?</span>
    <p class="mc-next-text">{whatsNextLine()}</p>
  </div>

  <div class="mc-row mc-loc">
    {#if editing}
      <span class="mc-label">Location</span>
      <LocationPicker lat={locationLat} lon={locationLon} required={true} onLocationSelected={handleLocationSelected} />
    {:else if locationAddress || (locationLat && locationLon)}
      <div class="mc-loc-read">
        <span class="mc-loc-label">Location</span>
        <span class="mc-loc-value">{locationAddress || `${locationLat}, ${locationLon}`}</span>
      </div>
    {/if}
  </div>

  <div class="mc-row mc-desc">
    {#if editing}
      <label class="mc-label" for="mc-desc">Description</label>
      <textarea id="mc-desc" class="mc-textarea" rows="5" maxlength={2000} placeholder="What is this mission about?" bind:value={description} />
    {:else}
      <p class="mc-desc-body">{description || '—'}</p>
    {/if}
  </div>

  {#if isAuthor}
    <div class="mc-actions">
      {#if canUseEdit}
        <button type="button" class="mc-btn mc-btn-secondary" on:click={toggleEditing}>
          {editing ? 'Done' : 'Edit'}
        </button>
      {/if}
      {#if !published}
        <button type="button" class="mc-btn mc-btn-primary" disabled={!firstPublishValid || saving || !onCommit} on:click={handleCommit}>
          {saving ? 'Publishing…' : 'Publish mission'}
        </button>
      {:else}
        {#if editing}
          <button type="button" class="mc-btn mc-btn-primary" disabled={!updateValid || saving || !onCommit} on:click={handleCommit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" class="mc-btn mc-btn-danger" disabled={deleting || !onDelete} on:click={handleDelete}>
            {deleting ? 'Removing…' : 'Delete mission'}
          </button>
        {/if}
      {/if}
    </div>
  {/if}

</div>

<style>
  .mission-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 0.25rem 0 0.5rem;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.92);
  }
  .mc-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }
  .mc-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
  }
  .mc-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.55);
  }
  .mc-input,
  .mc-textarea,
  .mc-link-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    color: inherit;
    padding: 0.5rem 0.65rem;
    font-size: 0.95rem;
  }
  .mc-textarea {
    resize: vertical;
    min-height: 120px;
  }
  .mc-link-input {
    font-size: 0.8rem;
    margin-top: 0.35rem;
  }
  .mc-lanes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.75rem 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  @media (max-width: 520px) {
    .mc-lanes {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .mc-lane {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.25rem;
    min-width: 0;
  }
  .mc-lane-focus {
    outline: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: 10px;
    padding: 0.25rem;
    margin: -0.25rem;
  }
  .mc-lane-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    padding: 0;
    color: rgba(255, 255, 255, 0.9);
  }
  .mc-lane-dim {
    opacity: 0.38;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.35);
  }
  .mc-lane-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mc-lane-icon.mc-grey :global(svg) {
    stroke: rgba(255, 255, 255, 0.35);
  }
  .mc-lane-label {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.2;
  }
  .mc-next {
    padding: 0.5rem 0;
  }
  .mc-next-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.62);
  }
  .mc-next-text {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.8);
  }
  .mc-loc-read {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.88rem;
  }
  .mc-loc-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }
  .mc-desc-body {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.5;
    white-space: pre-wrap;
    color: rgba(255, 255, 255, 0.85);
  }
  .mc-hint {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.5);
  }
  .mc-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .mc-btn {
    border-radius: 8px;
    padding: 0.55rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .mc-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mc-btn-primary {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.24);
    color: #fff;
  }
  .mc-btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.85);
  }
  .mc-btn-danger {
    background: rgba(239, 83, 80, 0.15);
    border-color: rgba(239, 83, 80, 0.45);
    color: #ffcdd2;
  }
</style>
