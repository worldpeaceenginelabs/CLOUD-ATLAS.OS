<script lang="ts">
  import Ticker from './Ticker.svelte';
  import Missions from './Missions.svelte';

  export let onOpenChange = (_open: boolean) => {};

  let open = false;
  $: onOpenChange(open);
</script>

<div class="mission-log" class:open>
  <div class="mission-log-ticker mission-log-panel">
    <Ticker onTickerClick={() => (open = !open)} />
  </div>
  <p class="mission-log-label" class:mission-log-panel={open}>Mission Log</p>
  {#if open}
    <div class="mission-log-content mission-log-panel">
      <Missions />
    </div>
  {/if}
</div>

<style>
  .mission-log {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .mission-log:not(.open) {
    height: auto;
    width: 100%;
  }

  .mission-log-panel {
    background: rgba(255, 255, 255, 0.08);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-sizing: border-box;
  }

  .mission-log.open .mission-log-ticker {
    border-radius: 12px 12px 0 0;
    border-bottom: none;
  }

  .mission-log.open .mission-log-label.mission-log-panel {
    border-radius: 0;
    border-top: none;
    border-bottom: none;
    padding: 6px 12px 4px;
  }

  .mission-log.open .mission-log-content {
    border-radius: 0 0 12px 12px;
    border-top: none;
  }

  .mission-log-ticker {
    flex-shrink: 0;
    height: 40px;
  }

  .mission-log-label {
    margin: 0;
    padding: 4px 0 0;
    font-size: 0.7rem;
    font-weight: 500;
    color: #fff;
    text-align: center;
    flex-shrink: 0;
  }

  .mission-log-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
