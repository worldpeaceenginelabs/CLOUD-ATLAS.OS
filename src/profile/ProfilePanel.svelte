<script lang="ts">
  // profile/ProfilePanel.svelte
  // -----------------------------------------------------------------------
  // Who this device is: the public identity, the caller's own listings and
  // missions, and the means to back up or replace the key. Dumb: it reads
  // props and dispatches `open` / `importKey` / `reload` / `close`. It never
  // touches the key store or the app Store itself — the secret key is only
  // fetched, on click, through the `loadNsec` function the parent hands in,
  // and never lives in the Store.
  //
  // After an import the running app still uses the old key. `reloadRequired`
  // shows the notice with the reload button.
  // -----------------------------------------------------------------------
  import { createEventDispatcher } from 'svelte';
  import { npubEncode } from 'nostr-tools/nip19';
  import { strings } from '../strings';
  import type { ListingRecord, MissionRecord } from '../orchestrator/appStore';
  import { formatExpiry } from '../shared/formatExpiry';
  import CloseButton from '../shared/CloseButton.svelte';

  export let ownPubkey: string | null = null;
  /** The caller's own listings / missions (the parent filters them by author). */
  export let listings: ListingRecord[] = [];
  export let missions: MissionRecord[] = [];
  export let reloadRequired = false;
  /** Set by the parent when the last import attempt was rejected. */
  export let importError: 'invalid' | 'failed' | null = null;
  /** Resolves with the secret key as `nsec…`. */
  export let loadNsec: () => Promise<string>;

  const dispatch = createEventDispatcher<{
    open: { id: string };
    importKey: { input: string };
    reload: void;
    close: void;
  }>();

  $: npub = ownPubkey ? npubEncode(ownPubkey) : null;

  let pubCopied = false;
  let pubCopyFailed = false;

  let nsec = '';
  let exportFailed = false;
  let copied = false;
  let copyFailed = false;
  let importInput = '';

  $: if (reloadRequired) {
    importInput = '';
    nsec = '';
  }

  function titleOf(record: ListingRecord | MissionRecord): string {
    const title = (record.content as Record<string, unknown>)?.title;
    if (typeof title === 'string' && title) return title;
    return record.kind === 'listing' ? record.domain : 'Mission';
  }

  async function showKey() {
    exportFailed = false;

    try {
      nsec = await loadNsec();
    } catch (error) {
      console.warn('[ProfilePanel] Could not load the key:', error);
      exportFailed = true;
    }
  }

  function hideKey() {
    nsec = '';
    copied = false;
    copyFailed = false;
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(nsec);
      copied = true;
      copyFailed = false;
      setTimeout(() => (copied = false), 2000);
    } catch (error) {
      console.warn('[ProfilePanel] Clipboard unavailable:', error);
      copied = false;
      copyFailed = true;
    }
  }

  async function copyPubkey() {
    if (!npub) return;

    try {
      await navigator.clipboard.writeText(npub);
      pubCopied = true;
      pubCopyFailed = false;
      setTimeout(() => (pubCopied = false), 2000);
    } catch (error) {
      console.warn('[ProfilePanel] Clipboard unavailable:', error);
      pubCopied = false;
      pubCopyFailed = true;
    }
  }

  function importKey() {
    const input = importInput.trim();
    if (!input) return;

    dispatch('importKey', { input });
  }
</script>

<div class="overlay" role="dialog" aria-label={strings.profile.heading}>
  <div class="column">
    <div class="header">
      <CloseButton position="absolute" top="0" right="0" onClose={() => dispatch('close')} />
      <h2 class="heading">{strings.profile.heading}</h2>
    </div>

    <div class="stack">

    <section class="block">
      <h3 class="subheading first">{strings.profile.listingsHeading}</h3>
      {#if listings.length}
        <div class="items">
          {#each listings as record (record.id)}
            <button class="item" on:click={() => dispatch('open', { id: record.id })}>
              <span class="item-title">{titleOf(record)}</span>
              <span class="item-meta">{record.domain} · expires {formatExpiry(record.expiresAt)}</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="warning">{strings.profile.listingsEmpty}</p>
      {/if}

    </section>

    <section class="block">
      <h3 class="subheading first">{strings.profile.missionsHeading}</h3>
      {#if missions.length}
        <div class="items">
          {#each missions as record (record.id)}
            <button class="item mission" on:click={() => dispatch('open', { id: record.id })}>
              <span class="item-title">{titleOf(record)}</span>
              <span class="item-meta">expires {formatExpiry(record.expiresAt)}</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="warning">{strings.profile.missionsEmpty}</p>
      {/if}
    </section>

    <section class="block">
      <h3 class="subheading first">{strings.profile.pubkeyHeading}</h3>
      <p class="warning">{strings.profile.pubkeyInfo}</p>

      {#if ownPubkey && npub}
        <span class="label small">{strings.profile.pubkeyNpub}</span>
        <input
          class="input mono"
          type="text"
          readonly
          value={npub}
          aria-label={strings.profile.pubkeyNpub}
          on:click={(e) => e.currentTarget.select()}
        />
        <div class="row">
          <button class="button" on:click={copyPubkey}>
            {pubCopied ? strings.profile.keyCopied : strings.profile.keyCopy}
          </button>
        </div>

        {#if pubCopyFailed}
          <p class="error">{strings.profile.pubkeyCopyFailed}</p>
        {/if}
      {/if}

      <h3 class="subheading">{strings.profile.keyHeading}</h3>
      <p class="warning">{strings.profile.keyWarning}</p>

      {#if nsec}
        <input class="input mono" type="text" readonly value={nsec} aria-label={strings.profile.keyHeading} on:click={(e) => e.currentTarget.select()} />
        <div class="row">
          <button class="button" on:click={copyKey}>{copied ? strings.profile.keyCopied : strings.profile.keyCopy}</button>
          <button class="button ghost" on:click={hideKey}>{strings.profile.keyHide}</button>
        </div>
        {#if copyFailed}
          <p class="error">{strings.profile.keyCopyFailed}</p>
        {/if}
      {:else}
        <div class="row">
          <button class="button ghost" on:click={showKey}>{strings.profile.keyShow}</button>
        </div>
      {/if}

      {#if exportFailed}
        <p class="error">{strings.profile.keyExportFailed}</p>
      {/if}

      <h3 class="subheading">{strings.profile.importHeading}</h3>
      <p class="warning">{strings.profile.importWarning}</p>
      <input
        class="input mono"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder={strings.profile.importPlaceholder}
        aria-label={strings.profile.importHeading}
        bind:value={importInput}
      />
      <div class="row">
        <button class="button" disabled={!importInput.trim()} on:click={importKey}>{strings.profile.importButton}</button>
      </div>

      {#if importError}
        <p class="error">
          {importError === 'invalid' ? strings.profile.importInvalid : strings.profile.importFailed}
        </p>
      {/if}

      {#if reloadRequired}
        <div class="reload">
          <p>{strings.profile.reloadNotice}</p>
          <button class="button primary" on:click={() => dispatch('reload')}>{strings.profile.reload}</button>
        </div>
      {/if}
    </section>
    </div>
  </div>
</div>

<style>
  /* Positions the column inside the globe window; it has no background and
     lets every click and drag outside the cards through to the globe. Below
     EntityDetails (z-index 40): a record opened from a row appears on top,
     the profile stays open. */
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(4.5rem + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    pointer-events: none;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .column {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(520px, 100%);
    max-height: 100%;
    pointer-events: auto;
  }

  .header {
    position: relative;
    flex: none;
  }

  /* Three separate cards, one below the other; only this part scrolls. */
  .stack {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .heading {
    margin: 0;
    padding: 0.2rem 3rem 0.6rem; /* symmetric, so the text stays centred next to the close button */
    text-align: center;
    font-size: 1.2em;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7);
  }

  .block {
    box-sizing: border-box;
    padding: 0 1.2rem 1.2rem;
    background: var(--accent-stripe), var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-left: 3px solid #335bf4;
    border-radius: var(--glass-radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .subheading {
    margin: 1.6rem 0 0.4rem;
    font-size: 0.95em;
  }

  .subheading.first {
    margin-top: 1.2rem;
  }

  .label {
    color: rgba(255, 255, 255, 0.65);
  }

  .label.small {
    display: block;
    margin-bottom: 0.3rem;
    font-size: 0.78em;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .warning {
    margin: 0 0 0.6rem;
    font-size: 0.8em;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.65);
  }

  .input {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 0.82rem;
  }

  .input:focus {
    outline: none;
    border-color: #2ae9c9;
  }

  .row {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.6rem;
  }

  .button {
    padding: 0.45rem 1rem;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .button:hover,
  .button:focus-visible {
    background: rgba(255, 255, 255, 0.22);
  }
  .button:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .button.ghost {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  .button.primary {
    background: linear-gradient(135deg, #335bf4, #2ae9c9);
    color: #04121a;
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 100%;
    padding: 0.5rem 0.65rem;
    text-align: left;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font: inherit;
    cursor: pointer;
  }
  .item:hover,
  .item:focus-visible {
    background: rgba(255, 255, 255, 0.12);
  }

  .item-title {
    font-size: 0.85rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .item-meta {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.65);
  }

  .error {
    margin: 0.5rem 0 0;
    font-size: 0.8em;
    color: #ff7b72;
  }

  .reload {
    margin-top: 1.4rem;
    padding: 0.8rem 1rem;
    border-radius: 10px;
    background: rgba(42, 233, 201, 0.12);
    border: 1px solid rgba(42, 233, 201, 0.45);
  }

  .reload p {
    margin: 0 0 0.6rem;
    font-size: 0.85em;
    line-height: 1.45;
  }
</style>
