<script lang="ts">
  import { joinRoom } from 'trystero/torrent';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { coordinates } from '../store';
  import { idb } from '../idb';
  import FormInput from '../components/FormInput.svelte';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';


  // Initialize IndexedDB using shared module
  const initializeIndexedDB = async (): Promise<void> => {
    await idb.openDB();
  };




///////////////////////////////////////////////////////////////////////////////////////

  // Function to delete old records from the locationpins object store
  async function deleteOldRecords() {
    try {
      const deletedCount = await idb.deleteOldRecords(30); // Delete records older than 30 days
      console.log(`Deleted ${deletedCount} old records from locationpins`);
    } catch (error) {
      console.error('Error deleting old records from locationpins:', error);
    }
  }

  // Function to delete old records from the localpins object store
  async function deleteOldRecordsLocal() {
    try {
      const deletedCount = await idb.deleteOldLocalRecords(30); // Delete records older than 30 days
      console.log(`Deleted ${deletedCount} old local records from localpins`);
    } catch (error) {
      console.error('Error deleting old local records from localpins:', error);
    }
  }

  // Function to store a record in the locationpins object store
  async function storeRecord(record: Record) {
    try {
      await idb.savePin(record);
      console.log('Stored record in IndexedDB');
    } catch (error) {
      console.error('Error storing record in IndexedDB:', error);
    }
  }

  // Function to store a record in the 'localpins' object store
  async function storeRecordInLocalPins(record: Record) {
    try {
      await idb.saveLocalPin(record);
      console.log('Stored record in localpins IndexedDB');
    } catch (error) {
      console.error('Error storing record in localpins IndexedDB:', error);
    }
  }

  // Function to load records from the locationpins object store
  async function loadRecordsFromIndexedDB() {
    try {
      return await idb.loadPins();
    } catch (error) {
      console.error('Error loading records from IndexedDB:', error);
      return [];
    }
  }



// START START START START START START START START START START START START START START START 



  // Function to initialize the app in the right sequence
 async function initializeApp(): Promise<void> {
  try {
    await initializeIndexedDB();
    await deleteOldRecords();
    await deleteOldRecordsLocal();
  } catch (error) {
    console.error('An error occurred during initialization:', error);
  }
  const storedRecords = await loadRecordsFromIndexedDB();
  records.set(storedRecords);
  recordCache.push(...storedRecords);
  console.log('Loaded records from IndexedDB');
}



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

  function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function startRoom() {
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
  let record: Record = createEmptyRecord();

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
    if ($coordinates.latitude && $coordinates.longitude && recordIsValid(record)) {
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

      record = createEmptyRecord(); // Reset record
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


  



  // Function to check if a record is valid
  function recordIsValid(rec: Record): boolean {
    const isTitleValid = rec.title.trim() !== '';
    // Define the regex pattern for Telegram Group URLs
    const linkPattern = /^(?:https?:\/\/)?(?:t\.me|telegram\.me|t\.dog|telegram\.dog)\/(?:joinchat\/|\+)?([\w-]+)$/i;
    const isLinkValid = linkPattern.test(rec.link.trim());
    
    return isTitleValid && isLinkValid;
  }

  


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
  
  // Function to create an empty record with appid as a suffix to the mapid
  function createEmptyRecord(): Record {
      return {
      mapid: crypto.randomUUID(), // Append the appid as a suffix to the mapid
      timestamp: new Date().toISOString(),
      title: '',
      text: '',
      link: '',
      longitude: '',
      latitude: '',
      category: 'actionevent',
      height: 0,
    };
  }

onMount(async () => { 
    await initializeApp();
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
      label="Telegram Group Link"
      placeholder="https://t.me/+rtygFbFZrJE5NjIy"
      bind:value={record.link}
      maxlength={100}
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
