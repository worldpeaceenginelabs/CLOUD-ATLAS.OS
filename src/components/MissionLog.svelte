<script lang="ts">
  import Ticker from './Ticker.svelte';
  import Missions from './Missions.svelte';

  let open = false;
</script>

<div class="mission-log" class:open>
  <div class="mission-log-ticker">
    <Ticker onTickerClick={() => (open = !open)} />
  </div>
  {#if open}
    <div class="mission-log-content">
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

  .mission-log-ticker,
  .mission-log-content {
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

  .mission-log.open .mission-log-content {
    border-radius: 0 0 12px 12px;
    border-top: none;
  }

  .mission-log-ticker {
    flex-shrink: 0;
    height: 40px;
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
