<script lang="ts">
  export let duration = '15s';
  export let colors = ['#ee7752', '#e73c7e', '#23a6d5', '#23d5ab'];
  export let direction = '-45deg';
  export let size = '400% 400%';
  export let animationType: 'gradient' | 'pulse' | 'both' = 'both';
  export let pulseDuration = '10s';
</script>

<div 
  class="animated-gradient {animationType}"
  style="
    --duration: {duration};
    --pulse-duration: {pulseDuration};
    --colors: {colors.join(', ')};
    --direction: {direction};
    --size: {size};
  "
>
  <slot />
</div>

<style>
  .animated-gradient {
    background: linear-gradient(var(--direction), var(--colors));
    background-size: var(--size);
  }

  .animated-gradient.gradient {
    animation: gradientBG var(--duration) ease infinite;
  }

  .animated-gradient.pulse {
    animation: pulse var(--pulse-duration) infinite;
  }

  .animated-gradient.both {
    animation: gradientBG var(--duration) ease infinite, pulse var(--pulse-duration) infinite;
  }

  @keyframes gradientBG {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes pulse {
    0% { 
      opacity: 1; 
    }
    50% { 
      opacity: 0.7; 
    }
    100% { 
      opacity: 1; 
    }
  }
</style>
