<script lang="ts">
  import { mission1 } from '../utils/mission1';
  import { missionProgress } from '../utils/missionProgress';

  export let onSelectMission: (index: 1 | 2 | 3) => void = () => {};

  $: m1Done = $mission1.status === 'completed';
  $: m3Unlocked = $missionProgress.mission2FirstOpened;
  $: m2Visited = $missionProgress.mission2FirstOpened;
  $: m3Visited = $missionProgress.mission3FirstOpened;

  const slotIndices: (1 | 2 | 3)[] = [1, 2, 3];
</script>

<div class="missions">
  {#each slotIndices as slotIndex (slotIndex)}
    {@const clickable = slotIndex === 1 || (slotIndex === 2 && m1Done) || (slotIndex === 3 && m3Unlocked)}
    {@const slot2Single = slotIndex === 2 && m1Done && m2Visited}
    {@const slot3Single = slotIndex === 3 && m3Unlocked && m3Visited}
    {@const singleLabel = slot2Single || slot3Single}
    <button
      type="button"
      class="mission-slot"
      class:mission-slot-single-label={singleLabel}
      class:new-mission={slotIndex === 1 && !m1Done}
      class:unlocked-ambient={(slotIndex === 2 && m1Done) || (slotIndex === 3 && m3Unlocked)}
      class:greyed={!clickable}
      disabled={!clickable}
      on:click={() => clickable && onSelectMission(slotIndex)}
    >
      {#if slotIndex === 1}
        <span class="mission-slot-title animated-gradient">
          {m1Done ? 'Marketing' : 'First Global Mission'}
        </span>
        <span class="mission-slot-subtitle animated-gradient">Operator Expansion</span>
      {:else if slot2Single}
        <span class="mission-slot-title animated-gradient">Swarm Governance</span>
      {:else if slotIndex === 2}
        <span class="mission-slot-title animated-gradient">Mission 2</span>
        <span class="mission-slot-subtitle animated-gradient">Swarm Governance</span>
      {:else if slot3Single}
        <span class="mission-slot-title animated-gradient">Omnipedia Creator</span>
      {:else if slotIndex === 3}
        <span class="mission-slot-title animated-gradient">Mission 3</span>
        <span class="mission-slot-subtitle animated-gradient">Omnipedia Editor</span>
      {/if}

      {#if slotIndex === 2 && !m1Done}
        <span class="locked-overlay" aria-hidden="true">
          <svg
            class="lock-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span class="locked-text">SOLVE FIRST MISSION TO UNLOCK</span>
        </span>
      {:else if slotIndex === 3 && !m3Unlocked}
        <span class="locked-overlay" aria-hidden="true">
          <svg
            class="lock-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span class="locked-text">OPEN MISSION 2 TO UNLOCK</span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .missions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    width: 100%;
    max-width: 380px;
    min-width: 0;
    box-sizing: border-box;
  }

  .mission-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: min(100%, 380px);
    min-height: 88px;
    padding: 20px 24px;
    background: rgba(10, 15, 25, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
    text-align: center;
    font-family: inherit;
  }

  .mission-slot.mission-slot-single-label {
    justify-content: center;
  }

  .mission-slot.mission-slot-single-label .mission-slot-title {
    margin: 0;
  }

  .mission-slot.new-mission {
    position: relative;
    border-color: transparent;
    z-index: 0;
  }

  .mission-slot.new-mission::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    z-index: -1;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  .mission-slot.unlocked-ambient {
    position: relative;
    border-color: transparent;
    z-index: 0;
  }

  .mission-slot.unlocked-ambient::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    z-index: -1;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  /* Active slots only (not .greyed): gold border on hover */
  .mission-slot:not(.greyed):not(.new-mission):not(.unlocked-ambient):hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #ffd700;
  }

  .mission-slot:not(.greyed).new-mission:hover::before,
  .mission-slot:not(.greyed).unlocked-ambient:hover::before {
    background: #ffd700;
    background-size: 100% 100%;
    animation: none;
  }

  .mission-slot.greyed {
    opacity: 0.7;
    cursor: default;
  }

  .mission-slot.greyed .mission-slot-title,
  .mission-slot.greyed .mission-slot-subtitle {
    background: none;
    background-clip: unset;
    -webkit-background-clip: unset;
    -webkit-text-fill-color: unset;
    color: rgba(255, 255, 255, 0.5);
  }

  .mission-slot-title {
    font-weight: 700;
    font-size: 1.4rem;
    line-height: 1.25;
  }

  .mission-slot-subtitle {
    font-weight: 600;
    font-size: 1.1rem;
    line-height: 1.4;
    margin-top: 4px;
    display: inline-block;
    padding-bottom: 3px;
  }

  .locked-overlay {
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.85);
  }

  .lock-icon {
    flex: 0 0 auto;
    opacity: 0.95;
  }

  .locked-text {
    line-height: 1.2;
  }

  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

</style>
