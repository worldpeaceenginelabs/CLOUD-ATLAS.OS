<script lang="ts">
  import { joinRoom } from 'trystero/torrent';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { coordinates } from '../../store.js';

  // Define for rate limiting
  let isFormDisabled = writable(false);

  // Define the IndexedDB database
let indexeddb: IDBDatabase;

// Function to initialize the IndexedDB database
async function initializeIndexedDB() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('indexeddbstore', 1);

    // Create object stores if they don't exist
    request.onupgradeneeded = function(event) {
      const db = request.result;
      console.log('onupgradeneeded called');
      if (!db.objectStoreNames.contains('locationpins')) {
        db.createObjectStore('locationpins', { keyPath: 'mapid' });
        console.log('Created object store locationpins');
      }
      if (!db.objectStoreNames.contains('client')) {
        db.createObjectStore('client', { keyPath: 'id' });
        console.log('Created object store client');
      }
      if (!db.objectStoreNames.contains('localpins')) {
        db.createObjectStore('localpins', { keyPath: 'mapid' });
        console.log('Created object store localpins');
      }
    };

    // On success, assign the result to the indexeddb variable
    request.onsuccess = function(event) {
      indexeddb = request.result;
      console.log('Database opened successfully');
      resolve();
    };

    // On error, reject the promise
    request.onerror = function(event) {
      console.error('Error opening database', request.error);
      reject(request.error);
    };
  });
}

let appidfromindexeddb = null;
let usernamefromindexeddb = null;

// Ensure username and appid

// BLOCK 001
// Function to fetch 'username' and 'appid' from the object store 'client', with id 1
async function fetchClientData() {
  let username = writable('');
  let appid = writable('');

  return new Promise<void>((resolve, reject) => {
    const transaction = indexeddb.transaction(['client'], 'readonly');
    const objectStore = transaction.objectStore('client');
    const request = objectStore.get(1);

    request.onsuccess = function(event) {
      if (request.result) {
        console.log('Data fetched successfully', request.result);
        username.set(request.result.username);
        appid.set(request.result.appid);

        // Update the variables outside of the function
        username.subscribe(value => { usernamefromindexeddb = value; });
        checkAndUpdate(); // New callback function to handle updates
        appid.subscribe(value => { appidfromindexeddb = value; });
        checkAndUpdate(); // New callback function to handle updates

        resolve();
      } else {
        console.error('Data not found');
        reject('Data not found');
      }
    };

    request.onerror = function(event) {
      console.error('Error fetching data', request.error);
      reject(request.error);
    };
  });
}

// Callback function to check if both values are updated
function checkAndUpdate() {
  if (usernamefromindexeddb !== null && appidfromindexeddb !== null) {
    console.log('Global AppID:', appidfromindexeddb);
    console.log('Global Username:', usernamefromindexeddb);
    
    // Perform any actions that depend on these values here
  }
}

// BLOCK 002
// Function to create new 'username' and 'appid' and store in the object store 'client', with id 1
async function putResultPairCreation() {
  const usernameRandom = crypto.randomUUID();
  const salt = 'salt1234';
  const resultAppid = await hashData(usernameRandom + salt);
  let resultPairCreation = { id: 1, username: usernameRandom, appid: resultAppid };

  return new Promise<void>((resolve, reject) => {
    const transaction = indexeddb.transaction(['client'], 'readwrite');
    const objectStore = transaction.objectStore('client');
    const request = objectStore.put(resultPairCreation);

    request.onsuccess = function(event) {
      console.log('Data has been written successfully:', resultPairCreation);
      resolve();
    };

    request.onerror = function(event) {
      console.error('Error writing data', request.error);
      reject(request.error);
    };
  });
}



// eventually adapt the markup
// {#await promise}
//   <p>Loading...</p>
// {:then data}
//   <p>Data: {JSON.stringify(data)}</p>
// {:catch error}
//   <p>Error: {error.message}</p>
// {/await}



///////////////////////////////////////////////////////////////////////////////////////

  // Function to delete old records from the locationpins object store
  function deleteOldRecords() {
    const transaction = indexeddb.transaction(['locationpins'], 'readwrite');
    const store = transaction.objectStore('locationpins');
    const recordsAge = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Open a cursor to iterate over the records
    const request = store.openCursor();

    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if (cursor) {
        // If the record is older than 30 days, delete it
        const recordTimestamp = new Date(cursor.value.timestamp);
        if (recordTimestamp < recordsAge) {
          store.delete(cursor.primaryKey);
          console.log(`Deleted record with primaryKey ${cursor.primaryKey}`);
        }
        cursor.continue();
      }
    };
  }

  // Function to delete old records from the locationpins object store
  function deleteOldRecordsLocal() {
    const transaction = indexeddb.transaction(['localpins'], 'readwrite');
    const store = transaction.objectStore('localpins');
    const recordsAge = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Open a cursor to iterate over the records
    const request = store.openCursor();

    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if (cursor) {
        // If the record is older than 30 days, delete it
        const recordTimestamp = new Date(cursor.value.timestamp);
        if (recordTimestamp < recordsAge) {
          store.delete(cursor.primaryKey);
          console.log(`Deleted record with primaryKey ${cursor.primaryKey}`);
        }
        cursor.continue();
      }
    };
  }

  // Function to store a record in the locationpins object store
  async function storeRecord(record: Record) {
    const transaction = indexeddb.transaction(['locationpins'], 'readwrite');
    const store = transaction.objectStore('locationpins');
    store.add(record).onsuccess = function() {
      console.log('Stored record in IndexedDB');
    };
  }

  // Function to store a record in the 'localpins' object store
  async function storeRecordInLocalPins(record: Record) {
    const transaction = indexeddb.transaction(['localpins'], 'readwrite');
    const store = transaction.objectStore('localpins');
    store.add(record).onsuccess = function() {
      console.log('Stored record in localpins IndexedDB');
    };
  }

  // Function to load records from the locationpins object store
  async function loadRecordsFromIndexedDB() {
    const transaction = indexeddb.transaction(['locationpins'], 'readonly');
    const store = transaction.objectStore('locationpins');
    const records: Record[] = [];

    // Open a cursor to iterate over the records
    const request = store.openCursor();

    return new Promise<Record[]>((resolve, reject) => {
      request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
          // Add the record to the records array
          records.push(cursor.value);
          cursor.continue();
        } else {
          // When there are no more records, resolve the promise
          resolve(records);
        }
      };

      request.onerror = function(event) {
        reject(request.error);
      };
    });
  }



// START START START START START START START START START START START START START START START 



// Function to initialize the app in the right sequence
 async function initializeApp(): Promise<string> {
  try {
    await initializeIndexedDB();
    await deleteOldRecords();
    await deleteOldRecordsLocal();
    
    try {
      await fetchClientData(); // Block 001
      console.log('Fetched client data successfully');
    } catch (error) {
      console.warn('Fetching client data failed, attempting to create new data:', error);
      // If Block 001 fails, then execute Block 002

      try {
        await putResultPairCreation(); // Block 002
        console.log('Created new client data successfully');
        // If Block 002 succeeds, then execute Block 001 again
        await fetchClientData(); // Block 001
        console.log('Fetched client data successfully after creation');
      } catch (error) {
        console.error('Block 002 failed:', error);
      }
    }
  } catch (error) {
    console.error('An error occurred in the outer block:', error);
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
  getRecord(async (data: Record, peerId: string) => {
    if (!recordCache.some(rec => rec.mapid === data.mapid)) {
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
  });

  // New peers receive all previous records
  const [sendCache, getCache] = room.makeAction('cache');

  getCache(async (data: Record[]) => {
    const receivedRecords = data.filter(rec => !recordCache.some(rc => rc.mapid === rec.mapid));
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
  });


  
  // Implement a rate-limiting function to verify if there are more than 5 records in 'locationpins' indexedDB with the same appid suffix as in 'clients' indexedDB.
  // Function to check the record count in 'localpins' and disable the form if necessary
  async function checkRecordCount() {
    const transaction = indexeddb.transaction(['localpins'], 'readonly');
    const store = transaction.objectStore('localpins');
    const countRequest = store.count();

    return new Promise<boolean>((resolve, reject) => {
      countRequest.onsuccess = function() {
        const count = countRequest.result;
        resolve(count > 5);
      };

      countRequest.onerror = function() {
        reject(countRequest.error);
      };
    });
  }

  // Define an async function to fetch and set form disabled status
  async function updateFormDisabledStatus() {
    const result = await checkRecordCount();
    isFormDisabled.set(result);
    }


  // Function to check if a record is valid
  function recordIsValid(rec: Record): boolean {
    const isTitleValid = rec.title.trim() !== '';
    // Define the regex pattern for GoFundMe URLs
    const linkPattern = /^https:\/\/(www\.)?gofundme\.com\/f\/[a-zA-Z0-9-]+\/?$/;
    const isLinkValid = linkPattern.test(rec.link.trim());
    
    return isTitleValid && isLinkValid;
  }

  // Function to validate latitude and longitude with max 6 decimal places
  function isValidCoordinate(coord) {
    const coordPattern = /^[-+]?([1-8]?\d(\.\d{1,6})?|90(\.0{1,6})?)$/;
    return coordPattern.test(coord);
  }

  function openChatGPT() {
        const chatGPTBaseURL = "https://chat.openai.com/chat";
        const query = encodeURIComponent(`optimize my call to action for clarity: Title: "${record.title}", Text: "${record.text}". Title max length: 100chars, Text max length: 150chars`);
        const fullURL = `${chatGPTBaseURL}?q=${query}`;
        window.open(fullURL, '_blank');
    }

  // Function to hash data using SHA-256
  async function hashData(data: string): Promise<string> {
    // Convert the string data to an array buffer
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    // Calculate the SHA-256 hash of the array buffer
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    // Convert the hash buffer to a hexadecimal string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
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
      category: 'crowdfunding',
    };
  }

onMount(async () => { 
    await initializeApp();
    startRoom(config);

    // Rate limiting
    updateFormDisabledStatus();
    // Set interval to continuously update form disabled status
    const intervalId = setInterval(async () => {
    updateFormDisabledStatus();
    }, 5000); // Update every 5 seconds (adjust interval as needed)
  
  });

</script>

<main transition:fade={{ duration: 500 }}>
  <h4>
        <div class="container">
          <div class="emoji">🌎</div>
          <div class="text">
          Turn your visionary ideas into reality with the power of Crowdfunding. Use parts of your recorded Brainstorming Sessions as Campaign Video. What could me more authentic? Cloud Atlas leverages GoFundMe.com’s reach, giving you access to their extensive network and visibility.
          </div>
      </div>
    <div class="container">
      <div class="emoji">🔥</div>
      <div class="text">
        No central authority!!!
      </div>
  </div>
  <div class="container">
    <div class="emoji">⚠️</div>
    <div class="text">
      Posts cannot be edited or deleted, and they will automatically disappear after 14 days.
    </div>
</div>
<div class="container">
  <div class="emoji">⚠️</div>
  <div class="text">
    You can have a maximum of 5 posts across all 4 dapps. Choose wisely!
  </div>
</div>
<div class="container">
  <div class="emoji">🔥</div>
  <div class="text">
    Other mechanisms for edit and delete are coming...
  </div>
</div>
</h4>
  
  {#if $isFormDisabled}
  <p style="color: red;">The form is not available due to the record limit.</p>
{:else}
  <form>
    <label><div style="text-align:left">Title</div></label>
    <input type="text" placeholder="The issue in one sentence - max 100 chars" maxlength="100" bind:value={record.title} required><br>

    <label><div style="text-align:left">Text</div></label>
    <textarea placeholder="Describe positive outcome in 10 #hashtags - max 150 chars" maxlength="150" bind:value={record.text} required></textarea><br>

    <label><div style="text-align:left">GoFundMe.org Link</div></label>
    <input type="text" placeholder="https://www.gofundme.com/f/your-campaign-name" maxlength="200" bind:value={record.link} required><br>

    <input type="hidden" bind:value={record.latitude} required>
    <input type="hidden" bind:value={record.longitude} required>
    <input type="hidden" bind:value={record.category} required>

    {#if $coordinates.latitude && $coordinates.longitude}
    <p class="coordgreen animated-gradient">Coordinates: {$coordinates.latitude}, {$coordinates.longitude}</p>
    {:else}
    <p class="coordgreen animated-gradient">Pin dropped...</p>
    {/if}
    
    <button on:click|preventDefault={send}>Drop Pin</button>
  </form>
  <button on:click={openChatGPT}>Improve Text Using ChatGPT</button>
  {/if}

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

  h4 {
    color: white;
    text-align: left;
    font-size: medium;
    height: 100px;  /* Set the height to make the content scrollable */
    overflow: auto; /* Enable scrolling when content overflows */
  }

  .container {
            display: flex;
            align-items: flex-start;
        }
        .emoji {
            margin-right: 5px; /* Adjust this value to add space between emoji and text */
        }
        .text {
            flex: 1;
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
