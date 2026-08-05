<script>
  import { createEventDispatcher } from 'svelte';

  export let options = [];     // [{ id, label }] — always all 5, in fixed order
  export let available = [];   // ids that are enabled for the current domain/model
  export let selected = [];    // array of currently chosen ids (multi-select)

  const dispatch = createEventDispatcher();

  function pick(id) {
    if (!available.includes(id)) return; // greyed-out options aren't clickable
    dispatch('toggle', { id }); // parent flips membership in its own array; modal stays open
  }

  function onBackdrop(e) {
    if (e.target === e.currentTarget) dispatch('close');
  }
</script>

<div class="backdrop" on:click={onBackdrop}>
  <div class="modal" role="dialog" aria-modal="true" aria-label="AnyPay">
    <button class="close" on:click={() => dispatch('close')} aria-label="Close">✕</button>
    <h2>ANYPAY</h2>
    <p class="hint">Select any that apply, then close with ✕.</p>
    <div class="options">
      {#each options as opt}
        <button
          class="option"
          class:selected={selected.includes(opt.id)}
          class:disabled={!available.includes(opt.id)}
          disabled={!available.includes(opt.id)}
          on:click={() => pick(opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .modal {
    position: relative;
    background: #161616;
    border: 1px solid #333;
    border-radius: 14px;
    padding: 28px 24px 24px;
    width: min(340px, calc(100vw - 40px));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  h2 {
    margin: 0 0 6px;
    color: #fff;
    font-size: 1em;
    letter-spacing: 1.5px;
    text-align: center;
  }

  .hint {
    margin: 0 0 18px;
    color: #888;
    font-size: 0.78em;
    text-align: center;
  }

  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    color: #888;
    font-size: 1em;
    cursor: pointer;
    line-height: 1;
    padding: 6px;
  }
  .close:hover { color: #fff; }

  .options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option {
    border: 1.5px solid;
    border-image: linear-gradient(90deg, #335bf4, #2ae9c9) 1;
    background: #111;
    color: #fff;
    border-radius: 10px;
    padding: 12px;
    font-size: 0.95em;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: opacity 0.2s, background 0.2s;
  }
  .option.selected {
    background: rgba(51, 91, 244, 0.38);
    border-image: none;
    border-color: #8fb0ff;
  }
  .option.disabled {
    opacity: 0.22;
    cursor: default;
    border-image: none;
    border-color: #444;
  }
</style>