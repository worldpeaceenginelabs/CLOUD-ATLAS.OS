<script lang="ts">
	// Import necessary modules from Cesium and Svelte
	import { onMount, onDestroy } from 'svelte';
	import {
	  Ion,
	  Viewer,
	  Cartesian3,
	  Entity,
	  JulianDate,
	  Cesium3DTileset,
	  CustomDataSource,
	  HeadingPitchRoll,
	  Transforms,
	  Math as CesiumMath,
	} from 'cesium';
	import * as Cesium from 'cesium';
	import "cesium/Build/Cesium/Widgets/widgets.css";
	import { 
		coordinates, 
		models, 
		resetAllStores, 
		viewer,
		currentHeight,
		is3DTilesetActive,
		enable3DTileset,
		userIonAccessToken,
		basemapProgress,
		tilesetProgress,
		isInitialLoadComplete,
		isRoamingAreaMode,
		roamingAreaBounds,
		roamingPaintSignal,
		roamingCancelSignal,
		roamingClearSignal,
		isRoamingActive,
		roamingModelCount,
		userLiveLocation,
		flyToLocation
	} from './store';
	import type { ModelData } from './types';
	import { idb } from './idb';
	import { setSceneCallbacks } from './utils/modelUtils';
	import { modalService } from './utils/modalService';
	import { getCurrentTimeIso8601 } from './utils/timeUtils';
	import { logger } from './utils/logger';
	import { roamingAnimationManager } from './utils/roamingAnimation';
	import { clampToSurface } from './utils/clampToSurface';
	import {
		resolveModelUri,
		modelPositionAndOrientation,
		removeEntityById,
		setModelVisibility,
		flyToLonLat,
		flyToEntityPosition,
		pickPositionToLonLat,
		addPickedPointMarker,
		renderListingMarkers,
		removeMarkers,
		removeMarkerById,
	} from './utils/cesiumHelpers';
	import { setupTouchTiltHandler, destroyTouchTiltHandler } from './utils/touchTiltHandler';
	import { hasActiveGigSession } from './gig/gigRecovery';
	import { getSharedNostr } from './services/nostrPool';
	import ListingDetail from './gig/ListingDetail.svelte';
	import RadialGigMenu from './components/RadialGigMenu.svelte';
	import { preselectedGigVertical, showRadialGigMenu, layerListings } from './store';
	import { LISTING_VERTICALS, VERTICALS, type ListingVerticalConfig } from './gig/verticals';
	import type { Listing, GigVertical, ListingVertical } from './types';
	import { initUserLocation, type UserLocationHandle } from './utils/cesiumUserLocation';
	import { initCameraMonitor, type CameraMonitorHandle } from './utils/cesiumCamera';
	import { initRoamingArea, type RoamingAreaHandle } from './utils/cesiumRoamingArea';
	import { loadCityLabels } from './utils/cesiumCityLabels';

// Global variables and states
let modelDataSource: CustomDataSource | null = new CustomDataSource('models');
let pointEntities: Entity[] = [];
let userLocationEntity: Entity | null = null;
let userRingEntities: Entity[] = [];
let userLocationInitialized = false;

// Radial menu state
let showRadialMenu = false;
let radialScreenX = 0;
let radialScreenY = 0;
let tileset: Cesium3DTileset | null = null;
let isBasemapLoaded = false;
let isTilesetLoaded = false;
let initialZoomComplete = false;
let cesiumViewer: any = null;

// Map layer state
const layerEntities: Record<string, Entity[]> = {};
let selectedListing: { listing: Listing; vertical: ListingVertical } | null = null;
let myNostrPk = '';

let escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

// Module handles (initialized in onMount)
let userLocation: UserLocationHandle;
let cameraMonitor: CameraMonitorHandle;
let roamingArea: RoamingAreaHandle;

// Reactive roaming signals
$: if ($roamingPaintSignal) roamingArea?.disableCamera();
$: if ($roamingCancelSignal) roamingArea?.cancelPainting();
$: if ($roamingClearSignal) roamingArea?.removeVisuals();

// Track created object URLs for proper cleanup (item 5)
let createdObjectURLs: string[] = [];

// Roaming animation state
let roamingAnimationFrameId: number | null = null;

// Export preview model functions for parent component
export { addPreviewModelToScene, removePreviewModelFromScene, updatePreviewModelInScene, updateRoamingModel, hideOriginalModel, showOriginalModel };
  
	const initializeData = async (): Promise<void> => {
		setSceneCallbacks({ addModelToScene, removeModelFromScene });
		await idb.openDB();
	};
  
	// Load all data using streamlined data manager
	const loadAllData = async () => {
		if (modelDataSource) {
			modelDataSource.entities.removeAll();
		}
  
		try {
			const loadedModels = await idb.loadModels();
			models.set(loadedModels);
			logger.info(`Loaded ${loadedModels.length} models`, { component: 'Cesium', operation: 'loadData' });
		} catch (error) {
			console.error('Error loading data:', error);
		}
	};
  



// Add 3D model to the scene
function addModelToScene(modelData: ModelData) {
	try {
		const modelUri = resolveModelUri(modelData, createdObjectURLs);
		if (!modelUri) { console.error('Invalid model source or missing URL/file'); return; }
		if (!modelDataSource) return;

		const { position, orientation } = modelPositionAndOrientation(modelData);
		modelDataSource.entities.add({
			id: modelData.id,
			name: modelData.name,
			position,
			model: {
				uri: modelUri,
				scale: modelData.transform.scale,
				minimumPixelSize: 64,
				maximumScale: 20000,
				show: true,
			},
			orientation,
			description: modelData.description || '3D Model'
		});

		logger.info(`Model added: ${modelData.name}`, { component: 'Cesium', operation: 'addModel' });
		
		if (modelData.roaming?.isEnabled) {
			roamingAnimationManager.addModel(modelData);
			roamingModelCount.set(roamingAnimationManager.getActiveModelCount());
			if (!$isRoamingActive) {
				startRoamingAnimation();
			}
		}
	} catch (error) {
		console.error('Error adding model to scene:', error);
	}
}

// Load all models from store
function loadModelsFromStore() {
	if (modelDataSource) {
		modelDataSource.entities.removeAll();
		
		// Clear existing roaming models
		roamingAnimationManager.clearAll();
		
		$models.forEach(modelData => {
			addModelToScene(modelData);
		});
		
		roamingModelCount.set(roamingAnimationManager.getActiveModelCount());
		if (roamingAnimationManager.getActiveModelCount() > 0 && !$isRoamingActive) {
			startRoamingAnimation();
		}
	}
}

// React to runtime Ion API key changes
$: {
	const token = $userIonAccessToken;
	if (token) {
		Ion.defaultAccessToken = token;
	} else {
		Ion.defaultAccessToken = import.meta.env.VITE_ION_ACCESS_TOKEN;
	}
}

// React to runtime 3D Tiles toggle
let tilesetLoading = false;
$: if (cesiumViewer) {
	if (!$enable3DTileset) {
		if (tileset) tileset.show = false;
		cesiumViewer.scene.globe.show = true;
		is3DTilesetActive.set(false);
	} else if (tileset) {
		const h = cesiumViewer.camera.positionCartographic.height;
		if (h <= 6000000) {
			cesiumViewer.scene.globe.show = false;
			tileset.show = true;
			is3DTilesetActive.set(true);
		}
	} else if (!tilesetLoading && $userIonAccessToken) {
		tilesetLoading = true;
		loadTilesetWithProgress().then(() => {
			tilesetLoading = false;
			if (tileset && $enable3DTileset) {
				const h = cesiumViewer.camera.positionCartographic.height;
				if (h <= 6000000) {
					cesiumViewer.scene.globe.show = false;
					tileset.show = true;
					is3DTilesetActive.set(true);
				}
			}
		});
	}
}

// Track previous models to prevent unnecessary reloads
let previousModelsSerialized = '[]';

// Reactive statement to automatically load models when store changes
$: if (cesiumViewer && modelDataSource) {
	const serialized = JSON.stringify($models);
	if (serialized !== previousModelsSerialized) {
		loadModelsFromStore();
		previousModelsSerialized = serialized;
	}
}

// Update ring positions when user location changes (after initial placement)
$: if (userLocationInitialized && $userLiveLocation && userRingEntities.length > 0 && userLocation) {
	userLocation.updateRingPositions(userRingEntities, $userLiveLocation.longitude, $userLiveLocation.latitude);
}

// Create user location entities the instant both geolocation and initial load are ready
$: if (initialZoomComplete && !userLocationInitialized && $userLiveLocation && cesiumViewer && userLocation) {
	userLocationInitialized = true;
	const { latitude, longitude } = $userLiveLocation;
	(async () => {
		const userPosition = await clampToSurface(longitude, latitude);
		const entities = userLocation.createRing('Your Location!', userPosition);
		entities.forEach(e => cesiumViewer!.entities.add(e));
		userLocationEntity = entities.find(e => e.id === 'Your Location!') || null;
		userRingEntities = entities;
	})();
	flyToLonLat(cesiumViewer, longitude, latitude, 20000000, 1.5);
}

// Reopen radial menu when signalled by back buttons in the gig panel
$: if ($showRadialGigMenu) {
	showRadialGigMenu.set(false);
	openRadialMenuCentered();
}

/** Open radial menu centered on screen and fly camera to user location. */
function openRadialMenuCentered() {
	radialScreenX = window.innerWidth / 2;
	radialScreenY = window.innerHeight / 2;
	showRadialMenu = true;
	flyToEntityPosition(cesiumViewer, userLocationEntity);
}

/** Open radial menu centered on screen and fly camera to the picked point. */
function openRadialMenuAtPickedPoint() {
	radialScreenX = window.innerWidth / 2;
	radialScreenY = window.innerHeight / 2;
	showRadialMenu = true;
	const center = pointEntities.find(e => e.id === 'pickedPoint') ?? null;
	flyToEntityPosition(cesiumViewer, center);
}

// Remove model from scene
function removeModelFromScene(modelId: string) {
	removeEntityById(modelDataSource, modelId);
	roamingAnimationManager.removeModel(modelId);
	roamingModelCount.set(roamingAnimationManager.getActiveModelCount());
}

// Roaming animation functions
function startRoamingAnimation() {
	if ($isRoamingActive) return;
	isRoamingActive.set(true);
	animateRoamingModels();
	logger.info('Roaming animation started', { component: 'Cesium', operation: 'startRoaming' });
}

function stopRoamingAnimation() {
	if (!$isRoamingActive) return;
	isRoamingActive.set(false);
	if (roamingAnimationFrameId) {
		cancelAnimationFrame(roamingAnimationFrameId);
		roamingAnimationFrameId = null;
	}
	logger.info('Roaming animation stopped', { component: 'Cesium', operation: 'stopRoaming' });
}

function animateRoamingModels() {
	if (!$isRoamingActive || !cesiumViewer || !modelDataSource) return;

	roamingAnimationManager.tick();

	for (const roamingModel of roamingAnimationManager.getAllRoamingModels()) {
		const position = roamingAnimationManager.getModelPosition(roamingModel.id);
		if (!position) continue;

		const entity = modelDataSource.entities.getById(roamingModel.id);
		if (entity) {
			const newPosition = Cartesian3.fromDegrees(
				position.longitude,
				position.latitude,
				position.height
			);
			entity.position = newPosition;
			entity.orientation = Transforms.headingPitchRollQuaternion(
				newPosition,
				new HeadingPitchRoll(
					CesiumMath.toRadians(position.heading),
					CesiumMath.toRadians(roamingModel.modelData.transform.pitch),
					CesiumMath.toRadians(roamingModel.modelData.transform.roll)
				)
			);
		}
	}

	roamingAnimationFrameId = requestAnimationFrame(animateRoamingModels);
}

function updateRoamingModel(modelData: ModelData) {
	// Update the roaming animation manager
	roamingAnimationManager.updateModel(modelData);
	
	// If roaming is enabled and animation is not running, start it
	if (modelData.roaming?.isEnabled && !$isRoamingActive) {
		startRoamingAnimation();
	}
}

// Preview model management
let previewModelDataSource: CustomDataSource | null = null;
let currentPreviewModelId: string | null = null;

// Add preview model to the scene (temporary, not saved to store)
function addPreviewModelToScene(modelData: ModelData) {
	try {
		// Remove existing preview model if any
		removePreviewModelFromScene();
		
		// Hide the original model if it exists (for edit mode)
		hideOriginalModel(modelData.id);
		
		// Create preview data source if it doesn't exist
		if (!previewModelDataSource) {
			previewModelDataSource = new CustomDataSource('previewModels');
			if (cesiumViewer) {
				cesiumViewer.dataSources.add(previewModelDataSource);
			}
		}

		const modelUri = resolveModelUri(modelData, createdObjectURLs);
		if (!modelUri) { console.error('Invalid model source or missing URL/file for preview'); return; }
		if (!previewModelDataSource) return;

		const { position, orientation } = modelPositionAndOrientation(modelData);
		const entity = previewModelDataSource.entities.add({
			id: modelData.id,
			name: modelData.name + ' (Preview)',
			position,
			model: {
				uri: modelUri,
				scale: modelData.transform.scale,
				minimumPixelSize: 64,
				maximumScale: 20000,
				show: true,
			},
			orientation,
			description: modelData.description || '3D Model Preview'
		});

		currentPreviewModelId = modelData.id;
		logger.info('Preview model added to scene: ' + modelData.name, { component: 'Cesium', operation: 'addPreviewModel' });
	} catch (error) {
		console.error('Error adding preview model to scene:', error);
	}
}

// Remove preview model from scene
function removePreviewModelFromScene() {
	if (previewModelDataSource && currentPreviewModelId) {
		removeEntityById(previewModelDataSource, currentPreviewModelId);
		showOriginalModel(currentPreviewModelId);
		currentPreviewModelId = null;
		logger.info('Preview model removed from scene', { component: 'Cesium', operation: 'removePreviewModel' });
	}
}

function hideOriginalModel(modelId: string) {
	setModelVisibility(modelDataSource, modelId, false);
}

function showOriginalModel(modelId: string) {
	setModelVisibility(modelDataSource, modelId, true);
}

// Update preview model in scene
function updatePreviewModelInScene(modelData: ModelData) {
	try {
		if (!previewModelDataSource || !currentPreviewModelId) {
			// No existing preview model, add a new one
			addPreviewModelToScene(modelData);
			return;
		}

		// Find the existing preview entity
		const entity = previewModelDataSource.entities.getById(currentPreviewModelId);
		if (!entity) {
			// Entity not found, add a new one
			addPreviewModelToScene(modelData);
			return;
		}

		const modelUri = resolveModelUri(modelData, createdObjectURLs);
		if (!modelUri) { console.error('Invalid model source or missing URL/file for preview update'); return; }

		const { position, orientation } = modelPositionAndOrientation(modelData);
		entity.position = position;
		entity.name = modelData.name + ' (Preview)';
		entity.description = modelData.description || '3D Model Preview';
		if (entity.model) {
			entity.model.uri = modelUri;
			entity.model.scale = modelData.transform.scale;
		}
		entity.orientation = orientation;

		logger.info('Preview model updated in scene: ' + modelData.name, { component: 'Cesium', operation: 'updatePreviewModel' });
	} catch (error) {
		console.error('Error updating preview model in scene:', error);
		// Fallback to remove and re-add
		removePreviewModelFromScene();
		addPreviewModelToScene(modelData);
	}
}

// Model operations now use centralized utilities from modelUtils.ts


	// Function to load assets with progress tracking
	async function loadAssetsWithProgress() {
		loadBasemapWithProgress();
		
		if ($enable3DTileset) {
			loadTilesetWithProgress();
		} else {
			isTilesetLoaded = true;
			tilesetProgress.set(100);
			checkIfBothLoaded();
		}
	}

	// Function to load basemap with progress
	async function loadBasemapWithProgress() {
		if (!cesiumViewer) return;
		
		// Simulate basemap loading progress with less frequent updates
		const progressInterval = setInterval(() => {
			if ($basemapProgress < 100) {
				basemapProgress.set($basemapProgress + Math.random() * 15); // Larger increments
				if ($basemapProgress > 100) basemapProgress.set(100);
			} else {
				clearInterval(progressInterval);
				isBasemapLoaded = true;
				checkIfBothLoaded();
			}
		}, 200); // Reduced frequency from 100ms to 200ms
	}

	// Function to load 3D tileset with progress
	async function loadTilesetWithProgress() {
		if (!cesiumViewer) return;
		
		try {
			tileset = await Cesium3DTileset.fromIonAssetId(2275207);
			cesiumViewer.scene.primitives.add(tileset);
			
			// Initially hide the tileset (will be shown when zooming in)
			tileset.show = false;
			
			// Optimize tileset for better performance
			tileset.maximumScreenSpaceError = 16; // Lower error for better quality
			tileset.preloadWhenHidden = true; // Preload tiles when hidden
			tileset.preloadFlightDestinations = true; // Preload for camera movements
			tileset.skipLevelOfDetail = true; // Skip LOD for better performance
			tileset.baseScreenSpaceError = 1024; // Base screen space error
			tileset.skipScreenSpaceErrorFactor = 16; // Skip factor
			tileset.skipLevels = 1; // Skip levels
			tileset.immediatelyLoadDesiredLevelOfDetail = true; // Load desired LOD immediately
			tileset.loadSiblings = false; // Don't load sibling tiles
			tileset.foveatedTimeDelay = 0.0; // Load tiles immediately during zoom
			
			// Simulate tileset loading progress, then mark as loaded
			let simulatedProgress = 0;
			const progressInterval = setInterval(() => {
				simulatedProgress += Math.random() * 20;
				if (simulatedProgress >= 100) {
					simulatedProgress = 100;
					clearInterval(progressInterval);
					isTilesetLoaded = true;
					checkIfBothLoaded();
				}
				tilesetProgress.set(simulatedProgress);
			}, 250);
		} catch (error) {
			console.log('Error loading tileset:', error);
			tilesetProgress.set(100);
			isTilesetLoaded = true;
			checkIfBothLoaded();
		}
	}

	// Function to check if both assets are loaded and zoom in
	function checkIfBothLoaded() {
		if (isBasemapLoaded && isTilesetLoaded && !$isInitialLoadComplete && cesiumViewer) {
			isInitialLoadComplete.set(true);
			cesiumViewer.camera.flyTo({
				destination: Cartesian3.fromDegrees(0, 0, 20000000),
				duration: 3.0,
				complete: () => { initialZoomComplete = true; }
			});
		}
	}

	// Function to set up event handlers
	function setupEventHandlers() {
		if (!cesiumViewer) return;

		
		// Listen for escape key to cancel painting (store reference for cleanup)
		escapeKeyHandler = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && $isRoamingAreaMode) {
				roamingArea.cancelPainting();
			}
		};
		window.addEventListener('keydown', escapeKeyHandler);

		// Debounce function to prevent multiple rapid touches
		function debounce(func: Function, wait: number) {
			let timeout: NodeJS.Timeout | null = null;
			return function(this: any, ...args: any[]) {
				clearTimeout(timeout!);
				timeout = setTimeout(() => func.apply(this, args), wait);
			};
		}

		cesiumViewer.screenSpaceEventHandler.setInputAction(debounce(function(click: any) {
			if (!cesiumViewer) return;

			if ($isRoamingAreaMode) {
				roamingArea.handleClick(click);
				return;
			}

			const pickedObject = cesiumViewer.scene.pick(click.position);

			if (Cesium.defined(pickedObject) && pickedObject.id) {
				const id = pickedObject.id.id;

				if (id === 'pickedPoint' || id?.startsWith('pickedPoint_')) {
					openRadialMenuAtPickedPoint();
					return;
				}

				if (id?.startsWith('Your Location!')) {
					openRadialMenuCentered();
				} else if (trySelectListingEntity(pickedObject)) {
					// handled by trySelectListingEntity
				} else if (id?.startsWith('model_')) {
					const modelData = $models.find(model => model.id === id);
					if (modelData) {
						modalService.showModelDetails(modelData);
					}
				}
			} else {
				handleCoordinatePick(click);
			}
		}, 300), Cesium.ScreenSpaceEventType.LEFT_CLICK);

		cesiumViewer.screenSpaceEventHandler.setInputAction((movement: any) => {
			if (!cesiumViewer) return;
			const picked = cesiumViewer.scene.pick(movement.endPosition);
			const hoveredId = picked?.id?.id;
			if (Cesium.defined(picked) && hoveredId) {
				cesiumViewer.canvas.style.cursor = 'pointer';
			} else {
				cesiumViewer.canvas.style.cursor = '';
			}
		}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	}


	let unsubFlyTo: (() => void) | null = null;

	// Initialization on mount
	onMount(async () => {
	// Hydrate user Ion key from IDB, fall back to env default
	try {
		await idb.openDB();
		const stored = await idb.loadSetting('ionAccessToken');
		if (stored) {
			Ion.defaultAccessToken = stored;
			userIonAccessToken.set(stored);
		} else {
			Ion.defaultAccessToken = import.meta.env.VITE_ION_ACCESS_TOKEN;
		}
	} catch {
		Ion.defaultAccessToken = import.meta.env.VITE_ION_ACCESS_TOKEN;
	}

	  
	  // Initialize Cesium viewer with configuration
	  cesiumViewer = new Viewer('cesiumContainer', {
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
	  
	  viewer.set(cesiumViewer);

	  // Initialize extracted modules
	  userLocation = initUserLocation(cesiumViewer, userLiveLocation);
	  cameraMonitor = initCameraMonitor({
		viewer: cesiumViewer,
		getTileset: () => tileset,
		getModelDataSource: () => modelDataSource,
		currentHeight,
		enable3DTileset,
		is3DTilesetActive,
	  });
	  roamingArea = initRoamingArea(cesiumViewer, roamingAreaBounds, isRoamingAreaMode);

	  // Remap touch gestures
	  const sscc = cesiumViewer.scene.screenSpaceCameraController;
	  sscc.tiltEventTypes = [
		Cesium.CameraEventType.MIDDLE_DRAG,
		{ eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
	  ];
	  sscc.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
	  sscc.zoomFactor = 15.0;

	  // Pitch clamp: prevent the camera from ever crossing the horizon
	  cesiumViewer.scene.preRender.addEventListener(() => {
		if (!cesiumViewer) return;
		const cam = cesiumViewer.camera;
		if (cam.pitch > CesiumMath.toRadians(-5)) {
		  cam.setView({ orientation: { heading: cam.heading, pitch: CesiumMath.toRadians(-5), roll: 0 } });
		}
	  });

	  setupTouchTiltHandler(cesiumViewer);
	  cesiumViewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
	  cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

	  // Camera monitoring
	  cesiumViewer.camera.moveStart.addEventListener(() => cameraMonitor.start());
	  cesiumViewer.camera.moveEnd.addEventListener(() => cameraMonitor.stop());

	  // Set initial camera position far out
	  cesiumViewer.scene.camera.setView({
		destination: Cartesian3.fromDegrees(0, 0, 10000000000),
		orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
	  });

	  userLocation.startTracking();
	  cameraMonitor.updateHeight();
	  loadAssetsWithProgress();

	// Function to get the current time in ISO 8601 format
	// Time formatting now uses centralized utility from timeUtils.ts

    // Get the current time in ISO 8601 format and update the viewer's clock
    const currentTime = getCurrentTimeIso8601();
    cesiumViewer.clock.currentTime = JulianDate.fromIso8601(currentTime);

	  // Atmosphere settings
	  const scene = cesiumViewer.scene;
	  const globe = scene.globe;
	  globe.enableLighting = true;
	  globe.atmosphereLightIntensity = 20.0;
	  scene.highDynamicRange = true;
  
	  // Initialize data manager and preload data asynchronously
	  // Don't block the main thread with data loading
	  initializeData()
		.then(() => {
		  // Load data in the background after initialization
		  return loadAllData();
		})
		.then(() => {
		  console.log('Data loaded successfully in background');
		})
		.catch((error) => {
		  console.error('Failed to initialize data manager:', error);
		});
	  
  
	  hasActiveGigSession()
	    .then(active => { if (active) modalService.showGigEconomy(); })
	    .catch(() => {});

	  if (modelDataSource) cesiumViewer.dataSources.add(modelDataSource);

	  // Set up event handlers for user interactions
	  setupEventHandlers();

	  unsubFlyTo = flyToLocation.subscribe(loc => {
	    if (loc && cesiumViewer) {
	      flyToLonLat(cesiumViewer, loc.lon, loc.lat, 5000, 1.5);
	      clampToSurface(loc.lon, loc.lat).then(clamped => {
	        if (!cesiumViewer) return;
	        pointEntities = addPickedPointMarker(cesiumViewer, clamped, pointEntities);
	      });
	      flyToLocation.set(null);
	    }
	  });

	  loadCityLabels(cesiumViewer).catch(e => console.error('Failed to load cities:', e));
	});

// ─── Listing Map Layers (generic per-vertical) ──────────────

function trySelectListingEntity(pickedObject: any): boolean {
  const id: string | undefined = pickedObject?.id?.id;
  if (!id) return false;
  for (const v of LISTING_VERTICALS) {
    const cfg = VERTICALS[v] as ListingVerticalConfig;
    if (id.startsWith(cfg.mapPrefix)) {
      const props = pickedObject.id.properties;
      if (props?.listing) {
        selectedListing = { listing: props.listing.getValue(JulianDate.now()), vertical: v };
      }
      return true;
    }
  }
  return false;
}

async function onLayerChanged(verticalId: ListingVertical, listings: Listing[]) {
  const cfg = VERTICALS[verticalId] as ListingVerticalConfig;
  const existing = layerEntities[verticalId] ?? [];
  if (listings.length === 0) {
    removeMarkers(cesiumViewer, existing);
    layerEntities[verticalId] = [];
    return;
  }
  await ensureMyPk();
  layerEntities[verticalId] = await renderListingMarkers(cesiumViewer, listings, existing, {
    idPrefix: cfg.mapPrefix, pointColor: cfg.color, getLabelText: (l) => l.title || '?', propertyKey: 'listing',
  });
}

function handleListingTakenDown(listingId: string) {
  if (!selectedListing) return;
  const cfg = VERTICALS[selectedListing.vertical] as ListingVerticalConfig;
  const entities = layerEntities[selectedListing.vertical] ?? [];
  removeMarkerById(cesiumViewer, entities, cfg.mapPrefix, listingId);
  selectedListing = null;
}

let prevLayerSnapshot: Record<string, Listing[]> = {};
$: {
  const all = $layerListings;
  for (const v of LISTING_VERTICALS) {
    const cur = all[v] ?? [];
    const prev = prevLayerSnapshot[v] ?? [];
    if (cur !== prev) {
      onLayerChanged(v, cur);
    }
  }
  prevLayerSnapshot = { ...all };
}

/** Handle radial menu category selection → open gig panel to that vertical. */
function handleRadialSelect(vertical: GigVertical) {
  showRadialMenu = false;
  modalService.hideGigEconomy();
  preselectedGigVertical.set(vertical);
  requestAnimationFrame(() => {
    modalService.showGigEconomy();
  });
}


function handleRadialClose() {
  showRadialMenu = false;
}

function flyToMyLocation() {
  const loc = $userLiveLocation;
  if (!loc || !userLocation) return;
  userLocation.flyToMe(loc);
}

/** Ensure we have the user's Nostr public key for ownership checks. */
async function ensureMyPk() {
  if (!myNostrPk) {
    try {
      const nostr = await getSharedNostr();
      myNostrPk = nostr.pubkey;
    } catch { /* non-critical here */ }
  }
}

function handleCoordinatePick(result: any) {
  if (!cesiumViewer) return;

  const cameraHeight = cesiumViewer.camera.positionCartographic.height;
  if (cameraHeight > 250000) {
    modalService.showZoomRequired();
    setTimeout(() => { modalService.hideZoomRequired(); }, 3000);
    return;
  }
  
  const coords = pickPositionToLonLat(cesiumViewer, result.position);
  if (!coords) return;

  coordinates.set({ 
    latitude: coords.latitude.toFixed(10), 
    longitude: coords.longitude.toFixed(10),
    height: coords.height,
  });

  pointEntities = addPickedPointMarker(cesiumViewer, coords.cartesian, pointEntities);
}

	onDestroy(() => {
		if (unsubFlyTo) unsubFlyTo();

		cameraMonitor?.cleanup();
		userLocation?.cleanup();
		roamingArea?.cleanup();
		destroyTouchTiltHandler();
		stopRoamingAnimation();

		if (escapeKeyHandler) {
			window.removeEventListener('keydown', escapeKeyHandler);
			escapeKeyHandler = null;
		}

		for (const key of Object.keys(layerEntities)) {
			removeMarkers(cesiumViewer, layerEntities[key]);
			layerEntities[key] = [];
		}

		if (modelDataSource) {
			modelDataSource.entities.removeAll();
			modelDataSource = null;
		}

		if (cesiumViewer) {
			cesiumViewer.dataSources.removeAll();
			cesiumViewer.entities.removeAll();
			cesiumViewer.scene.primitives.removeAll();
			if (cesiumViewer.screenSpaceEventHandler) {
				cesiumViewer.screenSpaceEventHandler.destroy();
			}
			cesiumViewer.destroy();
			viewer.set(null);
		}

		createdObjectURLs.forEach(url => URL.revokeObjectURL(url));
		createdObjectURLs = [];

		resetAllStores();
		modalService.closeAllModals();
		pointEntities = [];
		userLocationEntity = null;
		userRingEntities = [];
		userLocationInitialized = false;
		showRadialMenu = false;
		initialZoomComplete = false;
	});
</script>

<div style="width: 100%; display: flex; justify-content: center; align-items: center; position: relative;">
  <main id="cesiumContainer"></main>
  
  
  <!-- Height Display (bottom left) -->
  <div class="height-display">
    <div class="height-label">Height:</div>
    <div class="height-value">{Math.round($currentHeight / 1000)}km</div>
  </div>

  <!-- My Location button (bottom right) -->
  <button class="my-location-btn" on:click={flyToMyLocation} title="My Location">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  </button>
</div>

<!-- Listing Detail Overlay (shown on marker click) -->
{#if selectedListing}
  <ListingDetail
    listing={selectedListing.listing}
    vertical={selectedListing.vertical}
    myPk={myNostrPk}
    onClose={() => selectedListing = null}
    onTakenDown={handleListingTakenDown}
  />
{/if}

<!-- Radial Gig Menu (shown on user location ring tap) -->
{#if showRadialMenu}
  <RadialGigMenu
    screenX={radialScreenX}
    screenY={radialScreenY}
    onSelect={handleRadialSelect}
    onClose={handleRadialClose}
  />
{/if}




<style>
	main {
	  width: 100%;
	  height: 100vh;
	  height: 100dvh;
	  margin: 0;
	  padding: 0;
	}


	/* Height display (bottom left) */
	.height-display {
	  position: absolute;
	  bottom: 20px;
	  left: 10px;
	  z-index: 1000;
	  background: rgba(0, 0, 0, 0.7);
	  padding: 10px 15px;
	  border-radius: 8px;
	  -webkit-backdrop-filter: blur(10px);
	  backdrop-filter: blur(10px);
	  border: 1px solid rgba(255, 255, 255, 0.2);
	  display: flex;
	  align-items: center;
	  gap: 8px;
	}

	.height-label {
	  color: rgba(255, 255, 255, 0.8);
	  font-size: 12px;
	  font-weight: 500;
	  margin-bottom: 5px;
	  text-transform: uppercase;
	  letter-spacing: 0.5px;
	}

	.height-value {
	  color: #ffffff;
	  font-size: 18px;
	  font-weight: bold;
	  text-align: center;
	}

	/* My Location button (bottom right) */
	.my-location-btn {
	  position: absolute;
	  bottom: 20px;
	  right: 10px;
	  z-index: 1000;
	  width: 40px;
	  height: 40px;
	  border-radius: 10px;
	  background: rgba(255, 255, 255, 0.1);
	  border: 1px solid rgba(255, 255, 255, 0.3);
	  -webkit-backdrop-filter: blur(10px);
	  backdrop-filter: blur(10px);
	  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	  color: white;
	  padding: 0;
	  cursor: pointer;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  transition: all 0.2s;
	}

	.my-location-btn:hover {
	  background: rgba(255, 255, 255, 0.2);
	  transform: translateY(-2px);
	  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
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
	animation: fade-in 3s ease-in-out forwards;
	animation-delay: 4s;
	}






@keyframes fade-in {
	from { opacity: 0; }
	to { opacity: 1; }
}
</style>
  