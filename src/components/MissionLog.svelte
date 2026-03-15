<script lang="ts">
  import Ticker from './Ticker.svelte';
  import MissionComponent from './MissionComponent.svelte';

  let open = false;
</script>

<div class="mission-log">
  <div class="mission-log-ticker">
    <Ticker onTickerClick={() => (open = !open)} />
  </div>
  {#if open}
    <div class="mission-log-content">
      <MissionComponent />
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

  .mission-log-ticker {
    flex-shrink: 0;
    height: 40px;
  }

  .mission-log-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
