<!--
  Example Component Showing Refactored Glassmorphism Usage
  This demonstrates how to use the new utility classes instead of inline styles
-->

<script lang="ts">
  export let title = 'Example Card';
  export let content = 'This card uses the new glassmorphism utility classes.';
</script>

<!-- Using the new utility classes instead of inline styles -->
<div class="glassmorphism-card padding-lg">
  <h3 class="glassmorphism-title">{title}</h3>
  <p class="glassmorphism-content">{content}</p>
  
  <div class="glassmorphism-card-small padding-md margin-top-md">
    <p>This is a smaller card using glassmorphism-card-small</p>
  </div>
  
  <input 
    type="text" 
    placeholder="This input uses glassmorphism-input"
    class="glassmorphism-input margin-top-md"
  />
  
  <button class="glassmorphism-button padding-h-md margin-top-md">
    Glassmorphism Button
  </button>
</div>

<style>
  /* Custom styles that extend the utility classes */
  .glassmorphism-title {
    color: white;
    margin: 0 0 10px 0;
    font-size: 1.2em;
    font-weight: 600;
  }
  
  .glassmorphism-content {
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 15px 0;
    line-height: 1.4;
  }
  
  .margin-top-md {
    margin-top: 15px;
  }
  
  /* The utility classes handle all the glassmorphism styling */
  /* No need to duplicate: background, backdrop-filter, border, box-shadow, etc. */
</style>
