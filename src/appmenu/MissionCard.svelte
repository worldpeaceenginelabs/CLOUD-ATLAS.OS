<script lang="ts">
  import { slide } from 'svelte/transition';
  import LocationPicker from '../components/LocationPicker.svelte';
  import { verticalIconSvg } from '../gig/verticalIcons';
  import type { GigVertical, SwarmMissionCardPayload, SwarmMissionLane, SwarmMissionState } from '../types';
  import { openExternal } from '../utils/openExternal';
  import { ensureProtocol } from '../utils/urlUtils';

  export let mission: SwarmMissionCardPayload | null = null;
  export let viewerPubkey: string = '';
  export let accentColor: string = '#7E57C2';
  export let onCommit: ((data: SwarmMissionCardPayload) => void | Promise<void>) | undefined = undefined;
  export let onDelete: ((id: string) => void | Promise<void>) | undefined = undefined;
  /** Called after local success flags update; payload includes full card for republish. */
  export let onSuccessMark: ((data: SwarmMissionCardPayload) => void | Promise<void>) | undefined = undefined;

  const LANE_META: {
    lane: SwarmMissionLane;
    label: string;
    iconVertical: GigVertical;
    color: string;
    hasSuccess: boolean;
  }[] = [
    { lane: 'brainstorming', label: 'Brainstorm', iconVertical: 'brainstorming', color: '#FFCA28', hasSuccess: true },
    { lane: 'meetanddo', label: 'Meet & do', iconVertical: 'meetanddo', color: '#66BB6A', hasSuccess: false },
    { lane: 'petition', label: 'Petition', iconVertical: 'petition', color: '#AB47BC', hasSuccess: true },
    { lane: 'crowdfunding', label: 'Fund', iconVertical: 'crowdfunding', color: '#EF5350', hasSuccess: true },
  ];

  function emptySwarm(): SwarmMissionState {
    return {
      links: { brainstorming: '', meetanddo: '', petition: '', crowdfunding: '' },
      success: { brainstorming: false, petition: false, crowdfunding: false },
    };
  }

  let localId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `local-${Date.now()}`;
  let title = '';
  let description = '';
  let swarm: SwarmMissionState = emptySwarm();
  let locationLat = '';
  let locationLon = '';
  let locationAddress = '';

  let editing = false;
  let saving = false;
  let deleting = false;
  let focusedLane: SwarmMissionLane | null = null;

  $: published = mission !== null;
  $: authorPubkey = mission?.authorPubkey ?? viewerPubkey;
  $: isAuthor = viewerPubkey !== '' && viewerPubkey === authorPubkey;
  $: canUseEdit = isAuthor;
  $: brainstormDone = swarm.success.brainstorming;
  $: canEditMeetPetitionFund = !published || brainstormDone;

  $: if (mission) {
    localId = mission.id;
    title = mission.title;
    description = mission.description;
    swarm = {
      links: { ...mission.swarm.links },
      success: { ...mission.swarm.success },
    };
    locationLat = mission.locationLat ?? '';
    locationLon = mission.locationLon ?? '';
    locationAddress = mission.address ?? '';
  }

  function laneLit(lane: SwarmMissionLane): boolean {
    return !!swarm.links[lane]?.trim();
  }

  function whatsNextLine(): string {
    const parts: string[] = [];
    const open = (lane: SwarmMissionLane): boolean => {
      if (!swarm.links[lane]?.trim()) return false;
      if (lane === 'meetanddo') return true;
      if (lane === 'brainstorming') return !swarm.success.brainstorming;
      if (lane === 'petition') return !swarm.success.petition;
      return !swarm.success.crowdfunding;
    };
    if (open('brainstorming')) parts.push('Brainstorming is open — join via the link.');
    if (open('meetanddo')) parts.push('On-site / coordination is linked — use Meet & do.');
    if (open('petition')) parts.push('Petition is open — sign via the link.');
    if (open('crowdfunding')) parts.push('Funding is open — contribute via the link.');
    if (parts.length === 0) {
      if (!published) {
        return 'Publish with a brainstorm link first. After you mark brainstorm successful, you can add Meet & do, petition, and/or funding links.';
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

  function showSuccessButton(lane: SwarmMissionLane, hasSuccess: boolean): boolean {
    if (!hasSuccess || lane === 'meetanddo') return false;
    if (!published || !isAuthor) return false;
    if (!laneLit(lane)) return false;
    if (lane === 'brainstorming' && swarm.success.brainstorming) return false;
    if (lane === 'petition' && swarm.success.petition) return false;
    if (lane === 'crowdfunding' && swarm.success.crowdfunding) return false;
    return true;
  }

  function successVisible(lane: SwarmMissionLane, hasSuccess: boolean): boolean {
    if (!hasSuccess) return false;
    if (lane === 'brainstorming') return swarm.success.brainstorming;
    if (lane === 'petition') return swarm.success.petition;
    if (lane === 'crowdfunding') return swarm.success.crowdfunding;
    return false;
  }

  type SuccessLane = 'brainstorming' | 'petition' | 'crowdfunding';

  async function markLaneSuccess(lane: SuccessLane) {
    swarm.success[lane] = true;
    swarm = { ...swarm, success: { ...swarm.success } };
    await onSuccessMark?.(buildPayload());
  }

  function onMarkSuccessClick(lane: SwarmMissionLane) {
    if (lane === 'brainstorming' || lane === 'petition' || lane === 'crowdfunding') {
      void markLaneSuccess(lane);
    }
  }

  function linkEditable(lane: SwarmMissionLane): boolean {
    if (!editing) return false;
    if (lane === 'brainstorming') return true;
    if (!published) return false;
    return canEditMeetPetitionFund;
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
      timestamp: mission?.timestamp,
      swarm: {
        links: {
          brainstorming: swarm.links.brainstorming.trim(),
          meetanddo: swarm.links.meetanddo.trim(),
          petition: swarm.links.petition.trim(),
          crowdfunding: swarm.links.crowdfunding.trim(),
        },
        success: { ...swarm.success },
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
  {#if canUseEdit}
    <div class="mission-card-head">
      <button type="button" class="mc-edit" on:click={toggleEditing}>
        {editing ? 'Done' : 'Edit'}
      </button>
    </div>
  {/if}

  <div class="mc-row mc-title-row">
    {#if editing}
      <label class="mc-label" for="mc-title">Title</label>
      <input id="mc-title" class="mc-input" type="text" maxlength={200} placeholder="Mission title" bind:value={title} />
    {:else}
      <h2 class="mc-title">{title || 'Untitled mission'}</h2>
    {/if}
  </div>

  <div class="mc-row mc-lanes" transition:slide={{ duration: 200 }}>
    {#each LANE_META as { lane, label, iconVertical, color, hasSuccess }}
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
        {#if successVisible(lane, hasSuccess)}
          <span class="mc-success-pill">Success</span>
        {/if}
        {#if showSuccessButton(lane, hasSuccess)}
          <button type="button" class="mc-success-btn" on:click={() => onMarkSuccessClick(lane)}>Mark success</button>
        {/if}
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
      Only the brainstorm link is available until you publish. After publish, mark brainstorm successful to add Meet & do, petition, and/or funding links.
    </p>
  {:else if editing && published && !brainstormDone}
    <p class="mc-hint">Mark brainstorm successful to unlock the other link fields.</p>
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

  {#if canUseEdit}
    <div class="mc-actions">
      {#if !published}
        <button type="button" class="mc-btn mc-btn-primary" disabled={!firstPublishValid || saving || !onCommit} on:click={handleCommit}>
          {saving ? 'Publishing…' : 'Publish mission'}
        </button>
      {:else}
        <button type="button" class="mc-btn mc-btn-primary" disabled={!updateValid || saving || !editing || !onCommit} on:click={handleCommit}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" class="mc-btn mc-btn-danger" disabled={deleting || !onDelete} on:click={handleDelete}>
          {deleting ? 'Removing…' : 'Delete mission'}
        </button>
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
  .mission-card-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .mc-edit {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: inherit;
    border-radius: 8px;
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .mc-edit {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
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
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
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
    border: 1px solid color-mix(in srgb, var(--lane-color) 45%, transparent);
    background: color-mix(in srgb, var(--lane-color) 12%, transparent);
    cursor: pointer;
    padding: 0;
    color: var(--lane-color);
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
  .mc-success-pill {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #81c784;
  }
  .mc-success-btn {
    font-size: 0.65rem;
    padding: 0.2rem 0.45rem;
    border-radius: 6px;
    border: 1px solid rgba(129, 199, 132, 0.5);
    background: rgba(129, 199, 132, 0.12);
    color: #a5d6a7;
    cursor: pointer;
  }
  .mc-next {
    padding: 0.5rem 0;
  }
  .mc-next-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
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
    background: color-mix(in srgb, var(--accent) 35%, rgba(255, 255, 255, 0.08));
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    color: #fff;
  }
  .mc-btn-danger {
    background: rgba(239, 83, 80, 0.15);
    border-color: rgba(239, 83, 80, 0.45);
    color: #ffcdd2;
  }
</style>
