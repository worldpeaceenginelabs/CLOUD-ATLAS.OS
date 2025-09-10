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
	  ModelGraphics,
	  HeadingPitchRoll,
	  Transforms,
	  Math as CesiumMath,
	} from 'cesium';
	import * as Cesium from 'cesium';
	import "cesium/Build/Cesium/Widgets/widgets.css";
	import { coordinates, models, selectedModel, pins, resetAllStores, type ModelData, type PinData } from './store';
	import ShareButton from './Sharebutton.svelte';
	import { fade } from 'svelte/transition';
	import { idb } from './idb';
  
// Global variables and states
let isRecordModalVisible = false;
let selectedRecord: { mapid: string; latitude: string; longitude: string; category: string; title: string; text: string; link: string; timestamp: string } | null = null;
let viewer: Viewer | null = null;
let customDataSource: CustomDataSource | null = new CustomDataSource('locationpins');
let modelDataSource: CustomDataSource | null = new CustomDataSource('models');
let recordButtonText = '';
let isZoomModalVisible = false;
let isModelModalVisible = false;
let is3DTilesetActive = false; // Track if 3D tileset is currently active
let dataLoadedFor3DTileset = false; // Track if data has been loaded for 3D tileset
let pointEntity: Entity | null = null; // For coordinate picking
  
	// Initialize IndexedDB using shared module
	const initializeIndexedDB = async (): Promise<void> => {
		await idb.openDB();
	};
  
	// Load all records from IndexedDB (initial load)
	const loadRecordsFromIndexedDB = async () => {
		if (customDataSource) {
			customDataSource.entities.removeAll();
		}
  
		try {
			const loadedPins = await idb.loadPins();
			// Load pins directly to scene
			loadedPins.forEach((pinData: PinData) => {
				addRecordToMap(pinData);
			});
			// Update store silently to avoid triggering reactive statement
			pins.set(loadedPins);
			// Mark that initial loading is complete
			pinsLoadedFromIndexedDB = true;
			// Initialize the pin count for tracking changes
			previousPinCount = loadedPins.length;
		} catch (error) {
			console.error('Error loading pins from IndexedDB:', error);
		}
	};

	// Add a single record to the map
	const addRecordToMap = (record: { mapid: string, latitude: string, longitude: string, category: string, height: number }) => {
		const latitude = parseFloat(record.latitude);
		const longitude = parseFloat(record.longitude);

		if (!isNaN(latitude) && !isNaN(longitude) && record.height !== undefined) {
			// Use the stored height from the record - no fallback, height is required
			const height = record.height;
			const position = Cartesian3.fromDegrees(longitude, latitude, height);

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

			if (customDataSource) {
				customDataSource.entities.add(imageEntity);
			}
		} else {
			console.error('Invalid latitude or longitude for record:', record);
		}
	};

	// Remove a single record from the map
	const removeRecordFromMap = (mapid: string) => {
		if (customDataSource) {
			const entity = customDataSource.entities.getById(`${mapid}_image`);
			if (entity) {
				customDataSource.entities.remove(entity);
			}
		}
	};
  
	// Create a pulsating point entity
	const createPulsatingPoint = (pointId: string, userDestination: Cartesian3, color: Color): Entity => {
	  if (!viewer) return new Entity();
	  
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
		if (userLocation && viewer) {
		  const { longitude, latitude } = userLocation.coords;
		  const userPosition = Cartesian3.fromDegrees(longitude, latitude, 100);
  
		  const userLocationEntity = createPulsatingPoint('Your Location!', userPosition, Cesium.Color.BLUE);
		  viewer.entities.add(userLocationEntity);
  
		  setTimeout(() => {
			if (viewer) {
			  viewer.camera.flyTo({
				destination: Cartesian3.fromDegrees(longitude, latitude, 20000000.0),
			  });
			}
		  }, 3000);
		}
	  } catch (error) {
		console.error(error);
	  }
	};
  

// Add 3D model to the scene
function addModelToScene(modelData: ModelData) {
	try {
		const position = Cartesian3.fromDegrees(
			modelData.coordinates.longitude,
			modelData.coordinates.latitude,
			modelData.transform.height
		);

		const heading = CesiumMath.toRadians(modelData.transform.heading);
		const pitch = CesiumMath.toRadians(modelData.transform.pitch);
		const roll = CesiumMath.toRadians(modelData.transform.roll);

		// Create object URL for file uploads
		let modelUri: string;
		if (modelData.source === 'file' && modelData.file) {
			modelUri = URL.createObjectURL(modelData.file);
		} else if (modelData.source === 'url' && modelData.url) {
			modelUri = modelData.url;
		} else {
			console.error('Invalid model source or missing URL/file');
			return;
		}

		// Create the model entity
		if (!modelDataSource) return;
		
		const entity = modelDataSource.entities.add({
			id: modelData.id,
			name: modelData.name,
			position: position,
			model: {
				uri: modelUri,
				scale: modelData.transform.scale,
				minimumPixelSize: 64,
				maximumScale: 20000,
				show: true,
			},
			orientation: Transforms.headingPitchRollQuaternion(
				position,
				new HeadingPitchRoll(heading, pitch, roll)
			),
			description: modelData.description || '3D Model'
		});

		console.log('Model added to scene:', modelData.name);
	} catch (error) {
		console.error('Error adding model to scene:', error);
	}
}

// Load all models from store
function loadModelsFromStore() {
	if (modelDataSource) {
		modelDataSource.entities.removeAll();
		
		$models.forEach(modelData => {
			addModelToScene(modelData);
		});
	}
}

// Remove model from scene
function removeModelFromScene(modelId: string) {
	if (modelDataSource) {
		const entity = modelDataSource.entities.getById(modelId);
		if (entity) {
			modelDataSource.entities.remove(entity);
		}
	}
}

// Save model to IndexedDB
async function saveModelToIndexedDB(modelData: ModelData) {
	try {
		await idb.saveModel(modelData);
	} catch (error) {
		console.error('Error saving model to IndexedDB:', error);
	}
}

// Load models from IndexedDB (without triggering reactive updates)
async function loadModelsFromIndexedDB() {
	try {
		const loadedModels = await idb.loadModels();
		// Load models directly to scene without updating store
		loadedModels.forEach((modelData: ModelData) => {
			addModelToScene(modelData);
		});
		// Update store silently to avoid triggering reactive statement
		models.set(loadedModels);
		// Mark that initial loading is complete
		modelsLoadedFromIndexedDB = true;
		// Initialize the model count for tracking changes
		previousModelCount = loadedModels.length;
	} catch (error) {
		console.error('Error loading models from IndexedDB:', error);
	}
}

// Delete model from IndexedDB
async function deleteModelFromIndexedDB(modelId: string) {
	try {
		await idb.deleteModel(modelId);
	} catch (error) {
		console.error('Error deleting model from IndexedDB:', error);
	}
}

// Save pin to IndexedDB
async function savePinToIndexedDB(pinData: PinData) {
	try {
		await idb.savePin(pinData);
	} catch (error) {
		console.error('Error saving pin to IndexedDB:', error);
	}
}

// Delete pin from IndexedDB
async function deletePinFromIndexedDB(mapid: string) {
	try {
		await idb.deletePin(mapid);
	} catch (error) {
		console.error('Error deleting pin from IndexedDB:', error);
	}
}


  
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

	// Track if models have been initially loaded from IndexedDB
	let modelsLoadedFromIndexedDB = false;
	let previousModelCount = 0;

	// Track if pins have been initially loaded from IndexedDB
	let pinsLoadedFromIndexedDB = false;
	let previousPinCount = 0;

	// Reactive statement to handle new models added to store (only when 3D tileset is active)
	$: if (viewer && $models && is3DTilesetActive && modelsLoadedFromIndexedDB) {
		const currentModelCount = $models.length;
		
		// Only add new models when count increases
		if (currentModelCount > previousModelCount) {
			// New models were added, only add the new ones
			const newModels = $models.slice(previousModelCount);
			newModels.forEach(modelData => {
				addModelToScene(modelData);
				// Save new model to IndexedDB
				saveModelToIndexedDB(modelData);
			});
		}
		// Note: Model removal is handled individually by removeModelFromScene()
		// so we don't need to reload all models when count decreases
		
		previousModelCount = currentModelCount;
	}

	// Reactive statement to handle new pins added to store (only when 3D tileset is active)
	$: if (viewer && $pins && is3DTilesetActive && pinsLoadedFromIndexedDB) {
		const currentPinCount = $pins.length;
		
		// Only add new pins when count increases
		if (currentPinCount > previousPinCount) {
			// New pins were added, only add the new ones
			const newPins = $pins.slice(previousPinCount);
			newPins.forEach(pinData => {
				addRecordToMap(pinData);
				// Save new pin to IndexedDB
				savePinToIndexedDB(pinData);
			});
		}
		// Note: Pin removal is handled individually by removeRecordFromMap()
		// so we don't need to reload all pins when count decreases
		
		previousPinCount = currentPinCount;
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
  
		viewer.camera.moveEnd.addEventListener(async () => {
		  if (!viewer) return;
		  
		  const height = viewer.camera.positionCartographic.height;
		  if (height > 6000000) {
			// Show the base layer and hide the 3D tileset
			viewer.scene.globe.show = true;
			tileset.show = false;
			is3DTilesetActive = false;
			// Hide location pins and 3D models when using base layer
			if (customDataSource) customDataSource.show = false;
			if (modelDataSource) modelDataSource.show = false;
		  } else {
			// Hide the base layer and show the 3D tileset
			viewer.scene.globe.show = false;
			tileset.show = true;
			is3DTilesetActive = true;
			// Show location pins and 3D models when using 3D tileset
			if (customDataSource) customDataSource.show = true;
			if (modelDataSource) modelDataSource.show = true;
			// Load data only once when switching to 3D tileset for the first time
			if (!dataLoadedFor3DTileset) {
			  await loadRecordsFromIndexedDB();
			  await loadModelsFromIndexedDB();
			  dataLoadedFor3DTileset = true;
			}
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
  
	  // Initialize IndexedDB (but don't load data yet - wait for 3D tileset to be active)
	  try {
		await initializeIndexedDB();
		// Data will be loaded when 3D tileset becomes active
	  } catch (error) {
		console.error('Failed to open IndexedDB:', error);
	  }
  
	  // Add user location
	  addUserLocation();
	  
  
	  // Set up clustering for the custom data source
	  if (customDataSource) {
		  customDataSource.clustering.enabled = true;
		  customDataSource.clustering.pixelRange = 10;
		  customDataSource.clustering.minimumClusterSize = 2;
	  }
  
	  if (customDataSource) viewer.dataSources.add(customDataSource);
	  if (modelDataSource) viewer.dataSources.add(modelDataSource);

// Function to fetch record from IndexedDB
async function fetchRecord(mapid: string) {
  try {
    const pins = await idb.loadPins();
    return pins.find(pin => pin.mapid === mapid) || null;
  } catch (error) {
    console.error('Error fetching record from IndexedDB:', error);
    return null;
  }
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

function handleCoordinatePick(result: any) {
  if (!viewer) return;
  
  const cartesian = viewer.scene.pickPosition(result.position);
  if (!cartesian) return;

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  
  // Height is captured and stored in coordinates store

  // Store coordinates with full precision using toFixed with more decimal places
  coordinates.set({ 
    latitude: latitude.toFixed(10), 
    longitude: longitude.toFixed(10),
    height: cartographic.height
  });

  if (pointEntity && viewer) {
    viewer.entities.remove(pointEntity);
  }

  if (viewer) {
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
  }
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
if (viewer) {
  viewer.screenSpaceEventHandler.setInputAction(debounce(async function(click: any) {
    if (!viewer) return;
    
    const pickedObject = viewer.scene.pick(click.position);

  // If an object is picked, handle entity picking
  if (Cesium.defined(pickedObject) && pickedObject.id) {

    if (pickedObject.id.id === "pickedPoint") {
      // Do nothing or handle pickedPoint specific logic here if needed
    } else if (pickedObject.id && pickedObject.id.id.startsWith('model_')) {
      // Handle 3D model click
      const modelId = pickedObject.id.id;
      const modelData = $models.find(model => model.id === modelId);
      if (modelData) {
        selectedModel.set(modelData);
        isModelModalVisible = true;
      }
    } else {
      await handleEntityPick(pickedObject);
    }
  } else {
    // If no object is picked, handle coordinate picking
    if (viewer) {
      const height = viewer.camera.positionCartographic.height;
      if (height > 250000) {
        // Show the zoom modal
        isZoomModalVisible = true;
        // Auto-hide after 3 seconds
        setTimeout(() => {
          isZoomModalVisible = false;
        }, 3000);
      } else {
        handleCoordinatePick(click);
      }
    }
  }
}, 300), Cesium.ScreenSpaceEventType.LEFT_CLICK);
}




	});

	window.addEventListener("keydown", handleKeyDown);
  

	// Function to close modal
	function closeRecordModal() {
	  isRecordModalVisible = false;
	}



// Function to close model modal
function closeModelModal() {
  isModelModalVisible = false;
  selectedModel.set(null);
}


	// Event listener for closing modals on Escape key press
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeRecordModal();
    closeModelModal();
  }
}

	onDestroy(() => {
		// Remove event listeners
		window.removeEventListener("keydown", handleKeyDown);
		
		// Clean up Cesium viewer and resources
		if (viewer) {
			// Remove all data sources
			viewer.dataSources.removeAll();
			
			// Remove all entities
			viewer.entities.removeAll();
			
			// Remove all primitives
			viewer.scene.primitives.removeAll();
			
			// Remove event handlers
			if (viewer.screenSpaceEventHandler) {
				viewer.screenSpaceEventHandler.destroy();
			}
			
			// Destroy the viewer
			viewer.destroy();
			viewer = null;
		}
		
		// Clean up data sources
		if (customDataSource) {
			customDataSource.entities.removeAll();
			customDataSource = null;
		}
		
		if (modelDataSource) {
			modelDataSource.entities.removeAll();
			modelDataSource = null;
		}
		
		// Clean up object URLs to prevent memory leaks
		$models.forEach(model => {
			if (model.source === 'file' && model.file) {
				URL.revokeObjectURL(URL.createObjectURL(model.file));
			}
		});
  
		// Clear stores using the cleanup function
		resetAllStores();
		
		// Reset state variables
		isRecordModalVisible = false;
		isZoomModalVisible = false;
		isModelModalVisible = false;
		selectedRecord = null;
		pointEntity = null;
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
      <div class="modal-header">
        <h2>Record Details</h2>
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
  <div class="modal-zoom-overlay" transition:fade={{ duration: 500 }}>
    <div class="modal-zoom">
      <div>
        <p class="zoom-message">Zoom in until the city level comes into view — then you can drop a pin.</p>
      </div>
    </div>
  </div>
{/if}

{#if isModelModalVisible && $selectedModel}
  <div class="modal" transition:fade={{ duration: 500 }}>
    <div class="modal-record">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="close float-right" on:click={closeModelModal}>
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
      <div class="modal-header">
        <h2>3D Model Details</h2>
      </div>
      <div>
        <p class="title">{$selectedModel.name}</p>
        <p class="text">{$selectedModel.description || '3D Model'}</p>
        <p class="model-info">
          Scale: {$selectedModel.transform.scale}x | 
          Height: {$selectedModel.transform.height}m | 
          Source: {$selectedModel.source}
        </p>
      </div>
      <div>
        <p class="created">ADDED {formatTimestamp($selectedModel.timestamp)}</p>
        <button class="glassmorphism" on:click={() => {
          removeModelFromScene($selectedModel.id);
          deleteModelFromIndexedDB($selectedModel.id);
          models.update(currentModels => currentModels.filter(m => m.id !== $selectedModel.id));
          closeModelModal();
        }}>Remove Model</button>
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

	.model-info {
		text-align: center;
		font-size: 0.9em;
		color: rgba(255, 255, 255, 0.8);
		margin: 10px 0;
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


	.modal-record {
	  width: 90%;
	  max-width: 800px;
	  border-radius: 15px;
   	  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	  background-color: rgba(0, 0, 0, 0.5);
	  padding: 20px;
	}

	.modal-header {
	  text-align: center;
	  margin-bottom: 20px;
	  padding-bottom: 15px;
	  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.modal-header h2 {
	  color: white;
	  margin: 0;
	  font-size: 1.5em;
	  font-weight: 600;
	}

	.modal-zoom-overlay {
	  position: fixed;
	  top: 50%;
	  left: 50%;
	  transform: translate(-50%, -50%);
	  z-index: 1000;
	  pointer-events: none;
	}

	.modal-zoom {
	  background-color: rgba(0, 0, 0, 0.8);
	  border-radius: 15px;
	  padding: 20px;
	  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	  backdrop-filter: blur(10px);
	  border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.zoom-message {
	  color: white;
	  text-align: center;
	  font-size: 1.0em;
	  margin: 0;
	  font-weight: 500;
	}

	/* Mobile responsiveness */
	@media (max-width: 1120px) {
    

    .zoom-message {
      font-size: 0.9em;
    }
  }

  /* Mobile responsiveness */
	@media (max-width: 1020px) {
    

    .zoom-message {
      font-size: 0.8em;
    }
  }

  /* Mobile responsiveness */
	@media (max-width: 910px) {
    

    .zoom-message {
      font-size: 0.7em;
    }
  }

	/* Mobile responsiveness */
	@media (max-width: 768px) {
    

    .zoom-message {
      font-size: 0.7em;
    }
  }

  @media (max-width: 480px) {
    

    .zoom-message {
      font-size: 0.5em;
    }
  }

  @media (max-width: 400px) {
    

    .zoom-message {
      font-size: 0.5em;
    }
  }

  @media (max-width: 360px) {
    
    .zoom-message {
      font-size: 0.5em;
    }
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
  