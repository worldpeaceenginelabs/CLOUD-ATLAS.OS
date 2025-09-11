<!-- This component provides scrollbar styling that can be imported -->
<script lang="ts">
  // This component doesn't need any logic, just provides CSS
</script>

<style>
  /* WebKit Scrollbar Styles */
  :global(::-webkit-scrollbar) {
    width: 12px;
    height: 12px;
  }

  :global(::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  :global(::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.5);
  }

  /* Firefox Scrollbar Styles */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
  }

  :global(*::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.5);
  }
</style>
