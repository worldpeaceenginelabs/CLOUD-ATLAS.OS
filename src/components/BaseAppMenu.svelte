<script lang="ts">
  import { joinRoom } from 'trystero';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { coordinates } from '../store';
  import { idb } from '../idb';
  import FormInput from './FormInput.svelte';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import type { AppMenuCategory, PinData } from '../types';
  import { PLACEHOLDER_TEXT } from '../types';
  import { 
    deleteOldRecords, 
    deleteOldRecordsLocal, 
    storeRecord, 
    storeRecordInLocalPins, 
    loadRecordsFromIndexedDB, 
    initializeApp 
  } from '../utils/recordUtils';
  import { getCurrentTime } from '../utils/timeUtils';
  import { createEmptyRecord, recordIsValid, formRecordToPinData } from '../utils/formUtils';
  import { logger } from '../utils/logger';

  // Props
  export let category: AppMenuCategory;

  // Initialize IndexedDB using shared module
  const initializeIndexedDB = async (): Promise<void> => {
    await idb.openDB();
  };

  // Record management functions now use centralized utilities from recordUtils.ts

  // Trystero setup
  const trysteroroomname = import.meta.env.VITE_TRYSTERO_ROOM_NAME;
  const config = { appId: 'username' };
  const room = joinRoom(config, trysteroroomname);

  // Time formatting now uses centralized utility from timeUtils.ts

  function startRoom() {
    room.onPeerJoin(peerId => {
      sendCache(recordCache);
      logger.peerJoined(peerId);
    });

    room.onPeerLeave(peerId => {
      logger.peerLeft(peerId);
    });
  }

  // Create writable store for records
  const records = writable<PinData[]>([]);
  let record: PinData = formRecordToPinData(createEmptyRecord(category));

  // Create action to send record
  const [sendRecordAction, getRecord] = room.makeAction('record');

  // Record cache to send records to new peers
  let recordCache: PinData[] = [];
  const MAX_CACHE_SIZE = 10000;

  // Receive records from other peers
  getRecord(async (data: any, peerId: string) => {
    if (data && typeof data === 'object' && data.mapid && !recordCache.some(rec => rec.mapid === data.mapid)) {
      records.update(recs => [...recs, data]);
      recordCache.push(data);

      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.shift();
      }

      await storeRecord(data);
      logger.recordReceived(data.title || 'Untitled', peerId);
    }
  });

  // Send and receive records
  const send = async () => {
    if ($coordinates.latitude && $coordinates.longitude && recordIsValid(record)) {
      sendRecordAction(record);

      records.update(recs => [...recs, record]);
      recordCache.push(record);

      await storeRecordInLocalPins(record);
      logger.dataStored('localpins', record.mapid);

      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.shift();
      }

      await storeRecord(record);
      logger.recordSent(record.title);

      record = formRecordToPinData(createEmptyRecord(category));
      $coordinates.latitude = '';
      $coordinates.longitude = '';
    } else {
      logger.warn('Please click on the map to fetch coordinates', { component: 'BaseAppMenu', operation: 'send' });
    }
  };

  // Subscribe to coordinates from click/touch in store
  coordinates.subscribe(value => {
    record.latitude = value.latitude;
    record.longitude = value.longitude;
    record.height = value.height;
  });

  // New peers receive all previous records
  const [sendCache, getCache] = room.makeAction('cache');

  getCache(async (data: any) => {
    if (Array.isArray(data)) {
      const receivedRecords = data.filter(rec => rec && typeof rec === 'object' && rec.mapid && !recordCache.some(rc => rc.mapid === rec.mapid));
      records.update(recs => [...recs, ...receivedRecords]);
      recordCache.push(...receivedRecords);

      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.splice(0, recordCache.length - MAX_CACHE_SIZE);
      }

      for (const record of receivedRecords) {
        await storeRecord(record);
        logger.dataStored('locationpins', record.mapid);
      }
    }
  });


  onMount(async () => { 
    await initializeIndexedDB();
    const storedRecords = await initializeApp();
    records.set(storedRecords);
    recordCache.push(...storedRecords);
    startRoom();
  });
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
    
    <GlassmorphismButton variant="primary" onClick={send} fullWidth={true}>
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

  /* Scrollbar styles */
  main {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
  }

  main::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  main::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  main::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  main::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
</style>
