<script lang="ts">
	// Import necessary modules from Cesium and Svelte
	import { onMount, onDestroy } from 'svelte';
	import {
	  Ion,
	  Viewer,
	  Cartesian2,
	  Cartesian3,
	  Color,
	  Entity,
	  JulianDate,
	  SampledProperty,
	  ClockRange,
	  HermitePolynomialApproximation,
	  Cesium3DTileset,
	  CustomDataSource,
	} from 'cesium';
	import * as Cesium from 'cesium';
	import "cesium/Build/Cesium/Widgets/widgets.css";
	import CategoryChoice from "./DAPPS/HomeScreen/CategoryChoice.svelte";
	import { coordinates } from './store';
	import ShareButton from './Sharebutton.svelte';
	import { fade } from 'svelte/transition';
  
// Global variables and states
let isRecordModalVisible = false;
let isCategoryModalVisible = false;
let selectedRecord: { mapid: string; latitude: string; longitude: string; category: string; title: string; text: string; link: string; timestamp: string } | null = null;
let viewer: Viewer;
let db: IDBDatabase;
let customDataSource = new CustomDataSource('locationpins');
let recordButtonText = '';
let isZoomModalVisible = false;
let isDaNangModalVisible = false;
let isPaiModalVisible = false;
  
	// Open connection to IndexedDB
	const openDB = (): Promise<IDBDatabase> => {
	  return new Promise((resolve, reject) => {
		const request = indexedDB.open('indexeddbstore', 1);
  
		request.onupgradeneeded = function(event: IDBVersionChangeEvent) {
		  db = request.result;
		  if (!db.objectStoreNames.contains('locationpins')) {
			db.createObjectStore('locationpins', { keyPath: 'mapid' });
		  }
		  if (!db.objectStoreNames.contains('client')) {
			db.createObjectStore('client', { keyPath: 'appid' });
		  }
		};
  
		request.onsuccess = function(event: Event) {
		  db = request.result;
		  resolve(db);
		};
  
		request.onerror = function(event: Event) {
		  console.error('Error opening IndexedDB:', request.error);
		  reject(request.error);
		};
	  });
	};
  
	// Fetch and process records from IndexedDB
	const fetchRecordsFromIndexedDB = () => {
	  customDataSource.entities.removeAll();
  
	  const transaction = db.transaction('locationpins', 'readonly');
	  const objectStore = transaction.objectStore('locationpins');
	  const cursorRequest = objectStore.openCursor();
  
	  cursorRequest.onsuccess = function(event: Event) {
		const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
		if (cursor) {
		  addRecordToMap(cursor.value);
		  cursor.continue();
		}
	  };
  
	  cursorRequest.onerror = function(event: Event) {
		console.error('Error in cursor request:', cursorRequest.error);
	  };
  
	  transaction.onerror = function(event: Event) {
		console.error('Error in transaction:', transaction.error);
	  };
	};
  
	// Create a pulsating point entity
	const createPulsatingPoint = (pointId: string, userDestination: Cartesian3, color: Color): Entity => {
	  const start = JulianDate.now();
	  const mid = JulianDate.addSeconds(start, 0.5, new JulianDate());
	  const stop = JulianDate.addSeconds(start, 2, new JulianDate());
  
	  viewer.clock.startTime = start;
	  viewer.clock.currentTime = start;
	  viewer.clock.stopTime = stop;
	  viewer.clock.clockRange = ClockRange.LOOP_STOP;
  
	  const pulseProperty = new SampledProperty(Number);
	  pulseProperty.setInterpolationOptions({
		interpolationDegree: 3,
		interpolationAlgorithm: HermitePolynomialApproximation,
	  });
  
	  pulseProperty.addSample(start, 7.0);
	  pulseProperty.addSample(mid, 15.0);
	  pulseProperty.addSample(stop, 7.0);
  
	  return new Entity({
		id: pointId,
		position: userDestination,
		point: {
		  pixelSize: pulseProperty,
		  color: Cesium.Color.fromCssColorString('#4285F4'),
		  outlineColor: Cesium.Color.WHITE,
		  outlineWidth: 1,
		  disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
	  });
	};
  
	// Fetch user's geolocation
	const getLocationFromNavigator = (): Promise<GeolocationPosition> => {
	  return new Promise((resolve, reject) => {
		if (navigator.geolocation) {
		  navigator.geolocation.getCurrentPosition(resolve, reject);
		} else {
		  reject(new Error('Geolocation is not supported by this browser.'));
		}
	  });
	};
  
	// Add user's location as a pulsating point on the map
	const addUserLocation = async () => {
	  try {
		const userLocation = await getLocationFromNavigator();
		if (userLocation) {
		  const { longitude, latitude } = userLocation.coords;
		  const userPosition = Cartesian3.fromDegrees(longitude, latitude, 100);
  
		  const userLocationEntity = createPulsatingPoint('Your Location!', userPosition, Cesium.Color.BLUE);
		  viewer.entities.add(userLocationEntity);
  
		  setTimeout(() => {
			viewer.camera.flyTo({
			  destination: Cartesian3.fromDegrees(longitude, latitude, 20000000.0),
			});
		  }, 3000);
		}
	  } catch (error) {
		console.error(error);
	  }
	};
  
	const addRecordToMap = (record: { mapid: string, latitude: string, longitude: string, category: string }) => {
	const latitude = parseFloat(record.latitude);
	const longitude = parseFloat(record.longitude);

	if (!isNaN(latitude) && !isNaN(longitude)) {
		const position = Cartesian3.fromDegrees(longitude, latitude, 100);

		// Determine the image URL based on the category
		let imageURL: string = "./mapicons/brainstorming.png"; // Default value
		switch (record.category) {
			case 'brainstorming':
				imageURL = "./mapicons/brainstorming.png";
				break;
			case 'actionevent':
				imageURL = "./mapicons/actionevent.png";
				break;
			case 'petition':
				imageURL = "./mapicons/petition.png";
				break;
			case 'crowdfunding':
				imageURL = "./mapicons/crowdfunding.png";
				break;
			}

		// Create an image entity for the record
		const imageEntity = new Entity({
			id: `${record.mapid}_image`,
			position: position,
			billboard: {
				image: imageURL,  // The URL of the PNG file
				width: 50,        // Width of the image in pixels
				height: 50,       // Height of the image in pixels
				pixelOffset: new Cartesian2(0, -16),  // Adjust if needed
				disableDepthTestDistance: Number.POSITIVE_INFINITY,
			}
		});

		customDataSource.entities.add(imageEntity);
	} else {
		console.error('Invalid latitude or longitude for record:', record);
	}
};


  
	// Reactive statement to update recordButtonText based on modalRecord
	$: {
	if (selectedRecord) {
		const categoryMap: { [key: string]: string } = {
		brainstorming: "Join Brainstorming",
		actionevent: "Take Action Now",
		petition: "Sign Now",
		crowdfunding: "Back this Project",
		};
		recordButtonText = categoryMap[selectedRecord.category] || "Go";
	} else {
		recordButtonText = "Go";
	}
	}


  
	// Initialization on mount
	onMount(async () => {
	(window as any).CESIUM_BASE_URL = './';
	Ion.defaultAccessToken = import.meta.env.VITE_ION_ACCESS_TOKEN;
	// FOR LIVE EDIT: Ion.defaultAccessToken = 'yourtoken';
	// TO USE THE GLOBE IN LIVE EDIT GET A FREE API KEY AT https://ion.cesium.com/

	  
	  // Initialize Cesium viewer with configuration
	  viewer = new Viewer('cesiumContainer', {
		animation: false,
		fullscreenButton: false,
		vrButton: false,
		geocoder: false,
		homeButton: false,
		infoBox: true,
		selectionIndicator: false,
		timeline: false,
		navigationHelpButton: false,
		shouldAnimate: true,
		skyBox: false,
		sceneModePicker: false,
		baseLayerPicker: false,
		contextOptions: {
		  webgl: { alpha: true },
		},
	  });
	







	// Render the Cesium Container background transparent
	  viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;

	// Remove the doubleclick event handler
	  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  
	  // Load Cesium 3D Tileset
	  try {
		const tileset = await Cesium3DTileset.fromIonAssetId(2275207);
		viewer.scene.primitives.add(tileset);
	
		// Initially hide the 3D tileset
		tileset.show = true;
  
		viewer.camera.moveEnd.addEventListener(() => {
		  const height = viewer.camera.positionCartographic.height;
		  if (height > 6000000) {
			// Show the base layer and hide the 3D tileset
			globe.show = true;
			tileset.show = false;
		  } else {
			// Hide the base layer and show the 3D tileset
			globe.show = false;
			tileset.show = true;
		  }
		});
	  } catch (error) {
		console.log(error);
	  }
  
	  // Set initial camera position
	  const cameraPosition = viewer.scene.camera.positionCartographic;
	  viewer.scene.camera.setView({
		destination: Cartesian3.fromRadians(cameraPosition.longitude, cameraPosition.latitude, 20000000),
		orientation: {
		  heading: viewer.scene.camera.heading,
		  pitch: viewer.scene.camera.pitch,
		  roll: viewer.scene.camera.roll,
		},
	  });
	  
	// Function to get the current time in ISO 8601 format
	function getCurrentTimeIso8601() {
	const now = new Date();
	return now.toISOString();
	}

    // Get the current time in ISO 8601 format and update the viewer's clock
    const currentTime = getCurrentTimeIso8601();
    viewer.clock.currentTime = JulianDate.fromIso8601(currentTime);

	  // Atmosphere settings
	  const scene = viewer.scene;
	  const globe = scene.globe;
	  globe.enableLighting = true;
	  globe.atmosphereLightIntensity = 20.0;
	  scene.highDynamicRange = true;
  
	  // Initialize IndexedDB and fetch initial records
	  try {
		db = await openDB();
		fetchRecordsFromIndexedDB();
	  } catch (error) {
		console.error('Failed to open IndexedDB:', error);
	  }
  
	  // Add user location and fetch records periodically
	  addUserLocation();
	  setInterval(fetchRecordsFromIndexedDB, 5000);
  
	  // Set up clustering for the custom data source
	  customDataSource.clustering.enabled = true;
	  customDataSource.clustering.pixelRange = 10;
	  customDataSource.clustering.minimumClusterSize = 2;
  
	  viewer.dataSources.add(customDataSource);

// Function to fetch record from IndexedDB
async function fetchRecord(mapid: string) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('locationpins', 'readonly');
    const objectStore = transaction.objectStore('locationpins');
    const request = objectStore.get(mapid);

    request.onsuccess = function(event) {
      resolve(request.result);
    };

    request.onerror = function(event) {
      reject(request.error);
    };
  });
}

// This block handles user interactions with the Cesium viewer, including picking entities and coordinates.

// Function to handle entity picking
async function handleEntityPick(pickedFeature: any) {
  if (!pickedFeature || !pickedFeature.id) return;

  const entityId = pickedFeature.id.id;
  const mapid = entityId.replace(/(_image)$/, '');

  try {
    const record = await fetchRecord(mapid);
    if (record) {
      isRecordModalVisible = true;
      selectedRecord = record as { mapid: string; latitude: string; longitude: string; category: string; title: string; text: string; link: string; timestamp: string };
    }
  } catch (error) {
    console.error('Error fetching record:', error);
  }
}

// Function to handle coordinate picking
let pointEntity: Entity | null = null;
function handleCoordinatePick(result: any) {
  const cartesian = viewer.scene.pickPosition(result.position);
  if (!cartesian) return;

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(7);
  const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(7);

  coordinates.set({ latitude: latitudeString, longitude: longitudeString });

  if (pointEntity) {
    viewer.entities.remove(pointEntity);
  }

  pointEntity = viewer.entities.add({
    id: "pickedPoint",
    position: cartesian,
    billboard: {
      image: '../location-on.png', // Path to your map marker icon
      width: 32, // Adjust the width as needed
      height: 32, // Adjust the height as needed
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  isCategoryModalVisible = true;
}

// Load city data from local JSON
const response = await fetch('/cities.json');
const cities = await response.json();

// Add label collection to scene
const labels = viewer.scene.primitives.add(new Cesium.LabelCollection());

// Limit to first 100 cities for testing (optional)
const sample = cities.slice(0, 1200);

sample.forEach((city: any) => {
  const lat = parseFloat(city.lat);
  const lon = parseFloat(city.lng);

  if (isNaN(lat) || isNaN(lon)) return;

  labels.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    text: city.name, // This is what you want to show
    font: "24px sans-serif",
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    scaleByDistance: new Cesium.NearFarScalar(1.0, 1.0, 2.0e7, 0.0),
	eyeOffset: new Cesium.Cartesian3(0.0, 0.0, -12500),
  });
});



// Debounce function to prevent multiple rapid touches
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return function(this: any, ...args: any[]) {
    clearTimeout(timeout!);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Combined event handler for picking entities and coordinates
viewer.screenSpaceEventHandler.setInputAction(debounce(async function(click: any) {
  const pickedObject = viewer.scene.pick(click.position);

  // If an object is picked, handle entity picking
  if (Cesium.defined(pickedObject) && pickedObject.id) {
    // Check if the picked object is daNangBillboard
    if (pickedObject.id.id === 'daNangBillboard') {
      isDaNangModalVisible = true;  // Open Da Nang modal
      click.cancelBubble = true;    // Prevent other click handlers from being triggered
      return;
    }

    // Check if the picked object is PaiBillboard
    if (pickedObject.id.id === 'PaiBillboard') {
      isPaiModalVisible = true;    // Open Pai modal
      click.cancelBubble = true;   // Prevent other click handlers from being triggered
      return;
    }

    if (pickedObject.id.id === "pickedPoint") {
      // Do nothing or handle pickedPoint specific logic here if needed
    } else {
      await handleEntityPick(pickedObject);
    }
  } else {
    // If no object is picked, handle coordinate picking
    const height = viewer.camera.positionCartographic.height;
    if (height > 250000) {
      // Show the zoom modal
      isZoomModalVisible = true;
    } else {
      handleCoordinatePick(click);
    }
  }
}, 300), Cesium.ScreenSpaceEventType.LEFT_CLICK);




	});
  
	// Function to close modal
	function closeCategoryModal() {
	  isCategoryModalVisible = false;
	}

	// Function to close modal
	function closeRecordModal() {
	  isRecordModalVisible = false;
	}

	// Function to close zoom modal
function closeZoomModal() {
  isZoomModalVisible = false;
}

// Function to close Da Nang modal
function closeDaNangModal() {
  isDaNangModalVisible = false;
}

// Function to close Pai modal
function closePaiModal() {
  isPaiModalVisible = false;
}


	// Event listener for closing modals on Escape key press
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeCategoryModal();
    closeRecordModal();
    closeZoomModal();
  }
}

	window.addEventListener("keydown", handleKeyDown);

	onDestroy(() => {
  	window.removeEventListener("keydown", handleKeyDown);
	});
  

	
	// Function to format the timestamp on the posts
	function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);

    // extract parts of the timestamp
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Monate sind 0-basiert
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    // formating the timestamp output
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} UTC`;
  	}

  </script>
  

  
<div style="width: 100%; display: flex; justify-content: center; align-items: center;">
  <main id="cesiumContainer"></main>
</div>  




{#if isCategoryModalVisible}
  <div class="modal-category" transition:fade={{ duration: 500 }}>
    <div class="modal-category-content">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="close float-right" on:click={closeCategoryModal}>
        <svg viewBox="0 0 36 36" class="circle">
          <path
            stroke-dasharray="100, 100"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div><CategoryChoice /></div>
    </div>
  </div>
{/if}

{#if isRecordModalVisible && selectedRecord}
  <div class="modal" transition:fade={{ duration: 500 }}>
    <div class="modal-record">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="close float-right" on:click={closeRecordModal}>
        <svg viewBox="0 0 36 36" class="circle">
          <path
            stroke-dasharray="100, 100"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div>
        <p class="title">{selectedRecord.title}</p>
        <p class="text">{selectedRecord.text}</p>
      </div>
      <div>
        <p class="created">CREATED {formatTimestamp(selectedRecord.timestamp)}</p>
        <p><button class="glassmorphism"><a target="_blank" href={selectedRecord.link}>{recordButtonText}</a></button></p>
      </div>
      <div><ShareButton 
          title={selectedRecord.title} 
          text={selectedRecord.text} 
          link={selectedRecord.link} 
        /></div>
    </div>
  </div>
{/if}

{#if isZoomModalVisible}
  <div class="modal" transition:fade={{ duration: 500 }}>
    <div class="modal-zoom">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="close float-right" on:click={closeZoomModal}>
        <svg viewBox="0 0 36 36" class="circle">
          <path
            stroke-dasharray="100, 100"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div>
        <p class="zoom-message">Zoom in until the city comes into view — then you can drop a pin.</p>
      </div>
    </div>
  </div>
{/if}

<style>
	main {
	  width: 100%;
	  height: 100vh;
	  margin: 0;
	  padding: 0;
	opacity: 0; /* Initial state */
	animation: fade-in-scale-up 3s ease-in-out forwards; /* Apply the fade-in animation */
	animation-delay: 1s;
	}

	.title{
		text-align: center;
		font-size: 1.5em;
		font-weight: bold;
	}

	.text{
		text-align: center;
		font-size: 1.0em;
		font-weight: bold;
	}

	.created{
		text-align: center;
		font-size: 1.0em;
	}

	:global(.cesium-button.cesium-vrButton) {
	display: block;
	width: 100%;
	height: 100%;
	margin: 0;
	border-radius: 0;
	opacity: 0;
	animation: fade-in 3s ease-in-out forwards; /* Apply the fade-in animation */
	animation-delay: 4s;
	z-index: 60;
	}

	:global(.cesium-widget-credits){
	opacity: 0;
	animation: fade-in 3s ease-in-out forwards; /* Apply the fade-in animation */
	animation-delay: 4s;
	}

	a {
    color: inherit;
    text-decoration: none;
	}

	a:hover,
	a:visited,
	a:active {
		color: inherit;
		text-decoration: none;
	}

	button {
      padding: 10px 20px;
      
      cursor: pointer;
      color: white;
      border: none;
      border-radius: 5px;
      width: 100%;
    }
  
    button:hover {
      background-color: #abd6ff;
    }

	.modal {
	display: flex;
	justify-content: center;
	align-items: center;
	position: fixed;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}

.modal-category {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	margin-left: auto;
	margin-right: auto;
	max-width: 800px;
	width: 100%;
	height: 50%;
	overflow: auto;
}


	.modal-category-content {
	width: 100%; 
    border-radius: 15px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	background-color: rgba(0, 0, 0, 0.5);
	}

	.modal-record {
	  width: 90%;
	  max-width: 800px;
	  border-radius: 15px;
   	  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	  background-color: rgba(0, 0, 0, 0.5);
	  padding: 20px;
	}

	.float-right {
        float: right;
    }

	.glassmorphism{
	/* Apply glassmorphism style for the modal content */
	background: rgba(255, 255, 255, 0.1);
	backdrop-filter: blur(10px);
	border-radius: 10px;
	border: 1px solid rgba(255, 255, 255, 0.3);
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.close {
  --size: 22px;
  --borderSize: 2px;
  --borderColor: rgba(255, 255, 255, 1);
  --speed: 0.5s;

  width: var(--size);
  height: var(--size);
  position: relative;
  background: #455A64;
  border-radius: 50%;
  box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
  transition: 0.25s ease-in-out;
  cursor: pointer;
  animation: fade-in-scale-down var(--speed) ease-out 0.25s both;
}

/* Keyframes for fade-in-scale down effect */
@keyframes fade-in-scale-down {
    from {
        opacity: 0;
        transform: scale(1.1); /* Optional: add a slight zoom-in effect */
    }
    to {
        opacity: 1;
        transform: scale(1); /* Reset to normal scale */
    }
}

/* Keyframes for fade-in-scale-up effect */
@keyframes fade-in-scale-up {
    from {
        opacity: 0;
        transform: scale(0.01); /* Optional: add a slight zoom-in effect */
    }
    to {
        opacity: 1;
        transform: scale(1); /* Reset to normal scale */
    }
}

/* Keyframes for fade-in effect */
@keyframes fade-in {
    from {
        opacity: 0;
        }
    to {
        opacity: 1;
        }
}

.close .circle path {
  stroke: var(--borderColor);
  fill: none;
  stroke-width: calc(var(--borderSize) / 2);
  stroke-linecap: round;
  animation: progress var(--speed) ease-out 0.25s both;
}

@keyframes progress {
  from {
    stroke-dasharray: 0 100;
  }
}

.close span {
  display: block;
  width: calc(var(--size) / 4 - 2px);
  height: var(--borderSize);
  background: var(--borderColor);
  box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  position: absolute;
  --padding: calc(var(--size) / 3);
  transition: 0.25s ease-in-out;
  animation: slide-in var(--speed) ease-in-out 0.25s both;
}

@keyframes slide-in {
  from {
    width: 0;
  }
}

.close span:nth-child(2) {
  top: calc(var(--padding) - var(--borderSize) / 2);
  left: var(--padding);
  transform: rotate(45deg);
  transform-origin: top left;
}

.close span:nth-child(3) {
  top: calc(var(--padding) - var(--borderSize) / 2);
  right: var(--padding);
  transform: rotate(-45deg);
  transform-origin: top right;
}

.close span:nth-child(4) {
  bottom: calc(var(--padding) - var(--borderSize) / 2);
  left: var(--padding);
  transform: rotate(-45deg);
  transform-origin: bottom left;
}

.close span:nth-child(5) {
  bottom: calc(var(--padding) - var(--borderSize) / 2);
  right: var(--padding);
  transform: rotate(45deg);
  transform-origin: bottom right;
}

.close:hover {
  background: #37474F;
}

.close:hover span {
  width: calc(var(--size) / 4);
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
  