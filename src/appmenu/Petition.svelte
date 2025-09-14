<script lang="ts">
  import { joinRoom } from 'trystero/torrent';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { coordinates } from '../store';
  import { idb } from '../idb';
  import FormInput from '../components/FormInput.svelte';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import { 
    deleteOldRecords, 
    deleteOldRecordsLocal, 
    storeRecord, 
    storeRecordInLocalPins, 
    loadRecordsFromIndexedDB, 
    initializeApp 
  } from '../utils/recordUtils';
  import { getCurrentTime } from '../utils/timeUtils';
  import { createEmptyRecord, recordIsValidWithPattern, formRecordToPinData } from '../utils/formUtils';


  // Initialize IndexedDB using shared module
  const initializeIndexedDB = async (): Promise<void> => {
    await idb.openDB();
  };




///////////////////////////////////////////////////////////////////////////////////////

  // Record management functions now use centralized utilities from recordUtils.ts



// START START START START START START START START START START START START START START START 



// App initialization now uses centralized utility from recordUtils.ts



// START START START START START START START START START START START START START START START 

  // Access environment variable directly
const trysteroroomname = import.meta.env.VITE_TRYSTERO_ROOM_NAME;



// *******************************
// *                             *
// *  SWITCH ROOMNAME TO         *
// *  'TEST' FOR LIVE EDIT MODE  *
// *    THEN HIT STRG+S (Save)   *
// *                             *
// *******************************

  // Trystero logic
  const config = { appId: 'username' };
  const room = joinRoom(config, trysteroroomname);
// FOR LIVE EDIT: const room = joinRoom(config, '123456'); 
// FULLY FUNCTIONAL BUT THE GLOBE IS INVISIBLE.
// TO USE THE GLOBE IN LIVE EDIT GET A FREE API KEY AT https://ion.cesium.com/ 
// ENTER API KEY IN Cesium.svelte => (search (F3) "defaultAccessToken", more instruction provided there)

// *******************************
// *                             *
// *  SWITCH ROOMNAME TO         *
// *  'TEST' FOR LIVE EDIT MODE  *
// *    THEN HIT STRG+S (Save)   *
// *                             *
// *******************************

  // Time formatting now uses centralized utility from timeUtils.ts

function startRoom(): void {
    room.onPeerJoin(peerId => {
        // Send record cache to the new peer, but only the records the peer doesn't have yet
        sendCache(recordCache);
        console.log(`[${getCurrentTime()}] Peer ${peerId} joined`);
    });

    room.onPeerLeave(peerId => {
        console.log(`[${getCurrentTime()}] Peer ${peerId} left`);
    });
}
  



  // Create writable store for records
  const records = writable<Record[]>([]);
  let record: Record = createEmptyRecord('petition');

  // Create action to send record
  const [sendRecordAction, getRecord] = room.makeAction('record');

  // Record cache to send records to new peers
  let recordCache: Record[] = [];

  // Set a maximum size for the cache
  const MAX_CACHE_SIZE = 10000;

  // Receive records from other peers
  getRecord(async (data: any, peerId: string) => {
    if (data && typeof data === 'object' && data.mapid && !recordCache.some(rec => rec.mapid === data.mapid)) {
      records.update(recs => [...recs, data]);
      recordCache.push(data); // Add record to cache

      // Maintain cache size limit
      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.shift(); // Remove the oldest record
      }

      // Store received record in IndexedDB "locationpins" object store
      await storeRecord(data);
      console.log(`Received record from peer ${peerId} and stored in IndexedDB`);
    }
  });

  // Send and receive records
  const send = async () => {
    // Check if coordinates are present
    if ($coordinates.latitude && $coordinates.longitude && recordIsValidWithPattern(record, /^https:\/\/(www\.)?change\.org\/p\/[a-zA-Z0-9-]+\/?$/)) {
      sendRecordAction(record);

      // Immediately process the record as if it was received from another peer
      records.update(recs => [...recs, record]);
      recordCache.push(record);

      // Store the record in the 'localpins' object store as well
      await storeRecordInLocalPins(record);
      console.log('Record sent to localpins object store');

        // Maintain cache size limit
      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.shift(); // Remove the oldest record
      }

      await storeRecord(record);
      console.log('Self-processed the sent record and stored in IndexedDB');

      record = createEmptyRecord('petition'); // Reset record
      $coordinates.latitude = '';
      $coordinates.longitude = '';
    } else {
      console.log('Please click on the map to fetch coordinates');
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
      recordCache.push(...receivedRecords); // Add records to cache

      // Maintain cache size limit
      if (recordCache.length > MAX_CACHE_SIZE) {
        recordCache.splice(0, recordCache.length - MAX_CACHE_SIZE); // Keep only the latest records
      }

      // Store received records in IndexedDB "locationpins" object store
      for (const record of receivedRecords) {
        await storeRecord(record);
        console.log('Stored received record in IndexedDB');
      }
    }
  });


  




  // Function to validate latitude and longitude with max 6 decimal places



  // Record interface
  interface Record {
    mapid: string;
    timestamp: string;
    title: string;
    text: string;
    link: string;
    longitude: string;
    latitude: string;
    category: string;
    height: number;
    [key: string]: any; // Add index signature for Trystero compatibility
  }
  

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
      label="Change.org Link"
      placeholder="https://www.change.org/p/your-campaign-name"
      bind:value={record.link}
      maxlength={200}
      required={true}
    />

    <input type="hidden" bind:value={record.latitude} required>
    <input type="hidden" bind:value={record.longitude} required>
    <input type="hidden" bind:value={record.category} required>

    {#if $coordinates.latitude && $coordinates.longitude}
    <p class="coordgreen animated-gradient">Coordinates: {$coordinates.latitude}, {$coordinates.longitude}</p>
    <p class="coordgreen animated-gradient">Height: {$coordinates.height.toFixed(1)}m</p>
    {:else}
    <p class="coordgreen animated-gradient">Pin dropped...</p>
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

  form {
    border: 0px solid #ccc;
    padding-bottom: 1rem;
    margin: 0;
  }

  label {
    font-weight: bold;
  }

  input, textarea {
    width: 100%;
    padding: 0rem;
    margin-bottom: 0rem;
  }

  button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      color: white;
      border: none;
      border-radius: 5px;
      width: 100%;
      /* Apply glassmorphism style for the modal content */
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

  button:hover {
      background-color: #abd6ff;
    }




  .coordgreen {
    color: green; font-size:large; font-weight:900;
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


 /* WebKit Scrollbar Styles */
 ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    /* Firefox Scrollbar Styles */
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
    }

    *::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    *::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }

    *::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
</style>
