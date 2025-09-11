<script>
    import GlassmorphismButton from './GlassmorphismButton.svelte';
    
    export let title;
    export let text;
    export let link;
  
    // Create a reactive variable for shareData
    let shareData;
  
    // Use reactive statements to update shareData whenever any prop changes
    $: shareData = {
    text: `Unite for Impact: If you're passionate about creating a lasting change in the world, join our brainstorming session and be the catalyst.\n\nMore Missions on https://CloudAtlas.Club\n\nTitle: ${title}\n\nText: ${text}\n\nJoin Brainstorm Session: `,
    url: link  // Use 'url' for the Web Share API
  };
  
    // Function to handle sharing
    async function shareText() {
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          console.log('Text shared successfully');
        } catch (error) {
          console.error('Error sharing text:', error);
        }
      } else {
        console.warn('Web Share API is not supported in this browser');
      }
    }
  </script>
  
  <!-- Add a button to trigger the share functionality -->
  <GlassmorphismButton variant="primary" onClick={shareText} fullWidth={true}>
    Share
  </GlassmorphismButton>
  