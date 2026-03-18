<script lang="ts">
  import { missionTitleMain, missionTitleSub } from '../content/missionContent';
  import { missionProgress } from '../utils/missionProgress';

  export let onOpenMission: () => void = () => {};

  const SLOT_COUNT = 3;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    index: i + 1,
    active: i === 0,
    title: i === 0 ? missionTitleMain : `Mission ${i + 1}`,
    subtitle: i === 0 ? missionTitleSub : '',
  }));

  function onSlotClick(slot: { active: boolean }) {
    if (slot.active) {
      onOpenMission();
    }
  }
</script>

<div class="missions">
  {#each slots as slot}
    <button
      type="button"
      class="mission-slot"
      class:new-mission={slot.active && !$missionProgress.missionCompleted}
      class:locked-ambient={slot.index === 2 && !$missionProgress.missionCompleted}
      class:greyed={!slot.active}
      disabled={!slot.active}
      on:click={() => onSlotClick(slot)}
    >
      <span class="mission-slot-title animated-gradient">
        {slot.title}
      </span>
      {#if slot.subtitle}
        <span class="mission-slot-subtitle animated-gradient">
          {slot.subtitle}
        </span>
      {/if}

      {#if slot.index === 2 && !$missionProgress.missionCompleted}
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

  .mission-slot.locked-ambient {
    position: relative;
    border-color: transparent;
    z-index: 0;
  }

  .mission-slot.locked-ambient::before {
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

  /* Normal active missions: keep the existing hover border change */
.mission-slot:not(.greyed):not(.new-mission):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
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
