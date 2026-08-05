<script lang="ts">
    export let tooltip = null;
  </script>
  
  <div class="overlay-layer">
  
    {#if tooltip}
      <div class="model-tooltip">
        <p class="desc">{tooltip.description}</p>
        <p class="ex">{tooltip.examples}</p>
      </div>
    {/if}
  
  </div>
  
  <style>
  .overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 40;
    pointer-events: none;
  }
  
  .model-tooltip {
    position: absolute;
  
    top: max(16px, env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
  
    width: min(320px, calc(100% - 32px));
  
    background: #161616;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 10px 14px;
  
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 0.82em;
    line-height: 1.4;
    color: #ddd;
    text-align: center;
  
    box-shadow: 0 10px 30px rgba(0,0,0,.4);
  }
  
  .model-tooltip .desc {
    margin: 0 0 6px;
    color: #fff;
    font-weight: 600;
  }
  
  .model-tooltip .ex {
    margin: 0;
    color: #9aa4b2;
  }
  </style>