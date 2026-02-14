<script lang="ts">
  import { fade } from 'svelte/transition';
  import { coordinates } from '../store';
  import FormInput from './FormInput.svelte';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import type { AppMenuCategory } from '../types';
  import { PLACEHOLDER_TEXT } from '../types';
  import { createEmptyRecord, recordIsValid } from '../utils/formUtils';

  // Props
  export let category: AppMenuCategory;

  // Form state
  let record = createEmptyRecord(category);

  // Sync coordinates from map clicks into the form record
  coordinates.subscribe(value => {
    record.latitude = value.latitude;
    record.longitude = value.longitude;
    record.height = value.height;
  });

  // Submit handler (ghost — backend not yet wired)
  function handleSubmit() {
    if (!$coordinates.latitude || !$coordinates.longitude) {
      alert('Please click on the map to pick coordinates first.');
      return;
    }
    if (!recordIsValid(record)) {
      alert('Please fill in all required fields with valid data.');
      return;
    }

    // TODO: wire to Nostr event publishing
    alert('Pin validated! Backend not yet connected.');

    // Reset form
    record = createEmptyRecord(category);
    $coordinates.latitude = '';
    $coordinates.longitude = '';
  }
</script>

<main transition:fade={{ duration: 500 }}>
  <form>
    <FormInput 
      type="textarea"
      label="Title"
      placeholder="Enter a short, powerful mission name here - max 100 chars"
      bind:value={record.title}
      maxlength={100}
      required={true}
    />

    <FormInput 
      type="textarea"
      label="Text"
      placeholder="What's the mission in a nutshell? - max 250 chars"
      bind:value={record.text}
      maxlength={250}
      required={true}
    />

    <FormInput 
      type="url"
      label={PLACEHOLDER_TEXT[category].label}
      placeholder={PLACEHOLDER_TEXT[category].placeholder}
      bind:value={record.link}
      maxlength={200}
      required={true}
    />

    <input type="hidden" bind:value={record.latitude} required>
    <input type="hidden" bind:value={record.longitude} required>
    <input type="hidden" bind:value={record.category} required>

    {#if $coordinates.latitude && $coordinates.longitude}
    <p class="coord-green animated-gradient">Coordinates: {$coordinates.latitude}, {$coordinates.longitude}</p>
    <p class="coord-green animated-gradient">Height: {$coordinates.height.toFixed(1)}m</p>
    {:else}
    <p class="coord-green animated-gradient">Pin dropped...</p>
    {/if}
    
    <GlassmorphismButton variant="primary" onClick={handleSubmit} fullWidth={true}>
      Drop Pin
    </GlassmorphismButton>
  </form>
</main>

<style>
  main {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: white;
    padding: 0%;
    margin: 0%;
    text-decoration: none;
  }

  main form {
    border: 0px solid #ccc;
    padding-bottom: 1rem;
    margin: 0;
    box-sizing: border-box;
  }

  main :global(label) {
    font-weight: bold;
  }

  main :global(input),
  main :global(textarea) {
    width: 100%;
    padding: 0rem;
    margin-bottom: 0rem;
    box-sizing: border-box;
  }

  .coord-green {
    color: green;
    font-size: large;
    font-weight: 900;
  }

  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
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
</style>
