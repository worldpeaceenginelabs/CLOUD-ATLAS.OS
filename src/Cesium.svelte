<script lang="ts">
	// Import necessary modules from Cesium and Svelte
	import { onMount, onDestroy } from 'svelte';
	import {
	  Ion,
	  Viewer,
	  Cartesian3,
	  Color,
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
  
// Global variables and states
let modelDataSource: CustomDataSource | null = new CustomDataSource('models');
let pointEntity: Entity | null = null; // For coordinate picking
let userLocationEntity: Entity | null = null; // For user location on map (center dot, click target)
let userRingEntities: Entity[] = []; // All double-ring entities for user location
let userLocationInitialized = false; // Track if user location entity has been created

// Radial menu state
let showRadialMenu = false;
let radialScreenX = 0;
let radialScreenY = 0;
let geoWatchId: number | null = null; // For watchPosition cleanup
let isMonitoringCamera = false; // Track if camera monitoring is active
let animationFrameId: number | null = null; // For requestAnimationFrame
let tileset: Cesium3DTileset | null = null; // Global tileset reference
let isBasemapLoaded = false; // Local variable for basemap loading state
let isTilesetLoaded = false; // Local variable for tileset loading state
let initialZoomComplete = false; // True after the initial flyTo animation finishes
let cesiumViewer: any = null; // Global viewer reference

// Map layer state — generic per-vertical
const layerEntities: Record<string, Entity[]> = {};
let selectedListing: { listing: Listing; vertical: ListingVertical } | null = null;
let myNostrPk = '';

// Roaming area painting state
let roamingAreaStart: { latitude: number; longitude: number } | null = null;
let roamingAreaEntity: Entity | null = null;
let roamingAreaRectangle: Entity | null = null;
let roamingAreaOutline: Entity | null = null;

let escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

// Reactive roaming signals (replaces window events)
$: if ($roamingPaintSignal) disableCameraControls?.();
$: if ($roamingCancelSignal) cancelPaintingMode?.();
$: if ($roamingClearSignal) removeRoamingAreaVisuals?.();

// Track created object URLs for proper cleanup (item 5)
let createdObjectURLs: string[] = [];

// Roaming animation state
let roamingAnimationFrameId: number | null = null;
let isRoamingAnimationActive = false;

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
			loadedModels.forEach(m => addModelToScene(m));
			logger.info(`Loaded ${loadedModels.length} models`, { component: 'Cesium', operation: 'loadData' });
		} catch (error) {
			console.error('Error loading data:', error);
		}
	};
  
	// Create a double-ring pulsating indicator (outer blue, inner orange, offset timing)
	const createDoubleRing = (pointId: string, position: Cartesian3): Entity[] => {
	  if (!cesiumViewer) return [];

	  const t0 = Date.now();

	  const outerPulse = new Cesium.CallbackProperty(() => {
		const t = (Date.now() - t0) / 1000;
		return 22 + 4 * Math.sin((2 * Math.PI * t) / 4);
	  }, false);

	  const innerPulse = new Cesium.CallbackProperty(() => {
		const t = (Date.now() - t0) / 1000 - 0.7;
		return 13 + 3 * Math.sin((2 * Math.PI * t) / 4);
	  }, false);

	  const outer = new Entity({
		id: `${pointId}_outer`,
		position,
		point: {
		  pixelSize: outerPulse,
		  color: new Cesium.Color(0.26, 0.52, 0.96, 0.04),
		  outlineColor: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.7),
		  outlineWidth: 2,
		  disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
	  });

	  const inner = new Entity({
		id: `${pointId}_inner`,
		position,
		point: {
		  pixelSize: innerPulse,
		  color: new Cesium.Color(1.0, 0.43, 0.0, 0.04),
		  outlineColor: Cesium.Color.fromCssColorString('#FF6D00').withAlpha(0.7),
		  outlineWidth: 2,
		  disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
	  });

	  const center = new Entity({
		id: pointId,
		position,
		point: {
		  pixelSize: 4,
		  color: Cesium.Color.WHITE.withAlpha(0.85),
		  disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
	  });

	  const hitCanvas = document.createElement('canvas');
	  hitCanvas.width = 1;
	  hitCanvas.height = 1;
	  const ctx = hitCanvas.getContext('2d');
	  if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1); }

	  const hitArea = new Entity({
		id: `${pointId}_hitarea`,
		position,
		billboard: {
		  image: hitCanvas,
		  width: 52,
		  height: 52,
		  color: new Cesium.Color(1, 1, 1, 0.01),
		  disableDepthTestDistance: Number.POSITIVE_INFINITY,
		},
	  });

	  return [outer, inner, center, hitArea];
	};
  
	// Start user location tracking (single watchPosition handles both initial placement and live updates)
	const startUserLocationTracking = () => {
	  if (!navigator.geolocation || !cesiumViewer) return;
	  if (geoWatchId !== null) return; // already tracking

	  geoWatchId = navigator.geolocation.watchPosition(
		(position) => {
		  const { latitude, longitude } = position.coords;
		  userLiveLocation.set({ latitude, longitude });

		  if (userRingEntities.length > 0 && cesiumViewer) {
			clampToSurface(longitude, latitude).then(newPos => {
			  userRingEntities.forEach(e => {
				(e.position as any) = newPos;
			  });
			});
		  }
		},
		(error) => {
		  console.error('Geolocation error:', error);
		},
		{
		  enableHighAccuracy: true,
		  maximumAge: 10000,
		  timeout: 15000,
		}
	  );
	};

	// Stop user location tracking
	const stopUserLocationTracking = () => {
	  if (geoWatchId !== null && navigator.geolocation) {
		navigator.geolocation.clearWatch(geoWatchId);
		geoWatchId = null;
	  }
	};

	// Update height display
	const updateHeightDisplay = () => {
		if (cesiumViewer) {
			currentHeight.set(cesiumViewer.camera.positionCartographic.height);
		}
	};

	// Optimized camera monitoring function with throttling
	let lastHeightCheck = 0;
	const HEIGHT_CHECK_INTERVAL = 100; // Check every 100ms instead of every frame
	
	const monitorCameraHeight = () => {
		if (!cesiumViewer || !isMonitoringCamera) return;
		
		const now = performance.now();
		if (now - lastHeightCheck < HEIGHT_CHECK_INTERVAL) {
			// Skip this frame, continue monitoring
			animationFrameId = requestAnimationFrame(monitorCameraHeight);
			return;
		}
		
		lastHeightCheck = now;
		const height = cesiumViewer.camera.positionCartographic.height;
		currentHeight.set(height); // Update height display
		
	if ($enable3DTileset && tileset) {
		if (height > 6000000) {
			if ($is3DTilesetActive) {
				cesiumViewer.scene.globe.show = true;
				if (tileset) tileset.show = false;
				is3DTilesetActive.set(false);
				if (modelDataSource) modelDataSource.show = false;
			}
		} else {
			if (!$is3DTilesetActive) {
				cesiumViewer.scene.globe.show = false;
				if (tileset) tileset.show = true;
				is3DTilesetActive.set(true);
				if (modelDataSource) modelDataSource.show = true;
			}
		}
	} else {
		cesiumViewer.scene.globe.show = true;
		if (tileset) tileset.show = false;
		is3DTilesetActive.set(false);
		const showEntities = height <= 6000000;
		if (modelDataSource) modelDataSource.show = showEntities;
	}
		
		// Continue monitoring
		animationFrameId = requestAnimationFrame(monitorCameraHeight);
	};

	// Start real-time camera monitoring
	const startCameraMonitoring = () => {
		if (!isMonitoringCamera) {
			isMonitoringCamera = true;
			monitorCameraHeight();
		}
	};

	// Stop real-time camera monitoring
	const stopCameraMonitoring = () => {
		isMonitoringCamera = false;
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
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
			if (!isRoamingAnimationActive) {
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
			
			// Add to roaming animation if enabled
			if (modelData.roaming?.isEnabled) {
				roamingAnimationManager.addModel(modelData);
			}
		});
		
		// Start roaming animation if any models have roaming enabled
		const hasRoamingModels = $models.some(model => model.roaming?.isEnabled);
		if (hasRoamingModels && !isRoamingAnimationActive) {
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
let previousModels: ModelData[] = [];

// Reactive statement to automatically load models when store changes
$: if (cesiumViewer && modelDataSource) {
	// Only reload if the models array actually changed
	const modelsChanged = $models.length !== previousModels.length || 
		$models.some((model, index) => {
			const prevModel = previousModels[index];
			return !prevModel || 
				model.id !== prevModel.id || 
				model.name !== prevModel.name ||
				model.coordinates.latitude !== prevModel.coordinates.latitude ||
				model.coordinates.longitude !== prevModel.coordinates.longitude ||
				model.transform.scale !== prevModel.transform.scale ||
				model.transform.height !== prevModel.transform.height;
		});
	
	if (modelsChanged) {
		loadModelsFromStore();
		previousModels = [...$models]; // Update previous models
	}
}

// Create user location entities the instant both geolocation and initial load are ready
$: if (initialZoomComplete && !userLocationInitialized && $userLiveLocation && cesiumViewer) {
	userLocationInitialized = true;
	const { latitude, longitude } = $userLiveLocation;
	(async () => {
		const userPosition = await clampToSurface(longitude, latitude);
		const entities = createDoubleRing('Your Location!', userPosition);
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

// Remove model from scene
function removeModelFromScene(modelId: string) {
	removeEntityById(modelDataSource, modelId);
	roamingAnimationManager.removeModel(modelId);
}

// Roaming animation functions
function startRoamingAnimation() {
	if (isRoamingAnimationActive) return;
	
	isRoamingAnimationActive = true;
	roamingAnimationManager.resumeAll();
	
	// Start the animation loop
	animateRoamingModels();
	
	logger.info('Roaming animation started', { component: 'Cesium', operation: 'startRoaming' });
}

function stopRoamingAnimation() {
	if (!isRoamingAnimationActive) return;
	
	isRoamingAnimationActive = false;
	roamingAnimationManager.pauseAll();
	
	if (roamingAnimationFrameId) {
		cancelAnimationFrame(roamingAnimationFrameId);
		roamingAnimationFrameId = null;
	}
	
	logger.info('Roaming animation stopped', { component: 'Cesium', operation: 'stopRoaming' });
}

function animateRoamingModels() {
	if (!isRoamingAnimationActive || !cesiumViewer || !modelDataSource) return;
	
	// Update all roaming models
	const roamingModels = roamingAnimationManager.getAllRoamingModels();
	
	// Animation logging removed for better performance
	
	for (const roamingModel of roamingModels) {
		const position = roamingAnimationManager.getModelPosition(roamingModel.id);
		if (!position) continue;
		
		// Update the model entity position and orientation
		const entity = modelDataSource.entities.getById(roamingModel.id);
		if (entity) {
			const newPosition = Cartesian3.fromDegrees(
				position.longitude,
				position.latitude,
				position.height
			);
			
			// Update position using Cesium's position property
			entity.position = newPosition;
			
			// Update orientation using Cesium's orientation property
			const heading = CesiumMath.toRadians(position.heading);
			const pitch = CesiumMath.toRadians(roamingModel.modelData.transform.pitch);
			const roll = CesiumMath.toRadians(roamingModel.modelData.transform.roll);
			
			entity.orientation = Transforms.headingPitchRollQuaternion(
				newPosition,
				new HeadingPitchRoll(heading, pitch, roll)
			);
		}
	}
	
	// Continue animation loop
	roamingAnimationFrameId = requestAnimationFrame(animateRoamingModels);
}

function updateRoamingModel(modelData: ModelData) {
	// Update the roaming animation manager
	roamingAnimationManager.updateModel(modelData);
	
	// If roaming is enabled and animation is not running, start it
	if (modelData.roaming?.isEnabled && !isRoamingAnimationActive) {
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
				cancelPaintingMode();
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
				handleRoamingAreaClick(click);
				return;
			}

			const pickedObject = cesiumViewer.scene.pick(click.position);

			if (Cesium.defined(pickedObject) && pickedObject.id) {
				const id = pickedObject.id.id;
				if (id === 'pickedPoint') return;

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
			if (Cesium.defined(picked) && picked.id?.id && picked.id.id !== 'pickedPoint') {
				cesiumViewer.canvas.style.cursor = 'pointer';
			} else {
				cesiumViewer.canvas.style.cursor = '';
			}
		}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	}

	// Function to handle roaming area painting clicks
	function handleRoamingAreaClick(click: any) {
		if (!cesiumViewer) return;
		
		const coords = pickPositionToLonLat(cesiumViewer, click.position);
		if (!coords) return;
		const { longitude, latitude, cartesian } = coords;
		
		if (!roamingAreaStart) {
			// First click - start the area
			roamingAreaStart = { latitude, longitude };
			
			// Create a visual indicator for the starting point
			roamingAreaEntity = cesiumViewer.entities.add({
				position: cartesian,
				point: {
					pixelSize: 10,
					color: Cesium.Color.YELLOW,
					outlineColor: Cesium.Color.BLACK,
					outlineWidth: 2,
					disableDepthTestDistance: Number.POSITIVE_INFINITY,
				}
			});
		} else {
			// Second click - complete the area
			const bounds = {
				north: Math.max(roamingAreaStart.latitude, latitude),
				south: Math.min(roamingAreaStart.latitude, latitude),
				east: Math.max(roamingAreaStart.longitude, longitude),
				west: Math.min(roamingAreaStart.longitude, longitude)
			};
			
			// Update the store
			roamingAreaBounds.set(bounds);
			
			// Remove the starting point entity
			if (roamingAreaEntity) {
				cesiumViewer.entities.remove(roamingAreaEntity);
				roamingAreaEntity = null;
			}
			
			// Create a ground-draped rectangle fill
			roamingAreaRectangle = cesiumViewer.entities.add({
				rectangle: {
					coordinates: Cesium.Rectangle.fromDegrees(
						bounds.west, bounds.south, bounds.east, bounds.north
					),
					material: Cesium.Color.YELLOW.withAlpha(0.3),
					classificationType: Cesium.ClassificationType.BOTH
				}
			});

			// Create a separate polyline outline clamped to ground (ground-draped rectangles don't support outlines)
			roamingAreaOutline = cesiumViewer.entities.add({
				polyline: {
					positions: Cesium.Cartesian3.fromDegreesArray([
						bounds.west, bounds.south,
						bounds.east, bounds.south,
						bounds.east, bounds.north,
						bounds.west, bounds.north,
						bounds.west, bounds.south
					]),
					width: 2,
					material: Cesium.Color.YELLOW,
					clampToGround: true
				}
			});
			
			roamingAreaBounds.set(bounds);
			
			// Re-enable camera controls
			enableCameraControls();
			
			// Reset for next area
			roamingAreaStart = null;
		}
	}

	// Function to disable camera controls
	function disableCameraControls() {
		if (cesiumViewer) {
			const ctrl = cesiumViewer.scene.screenSpaceCameraController;
			ctrl.enableRotate = false;
			ctrl.enableTranslate = false;
			ctrl.enableZoom = false;
			ctrl.enableTilt = false;
			ctrl.enableLook = false;
		}
	}

	function enableCameraControls() {
		if (cesiumViewer) {
			const ctrl = cesiumViewer.scene.screenSpaceCameraController;
			ctrl.enableRotate = true;
			ctrl.enableTranslate = true;
			ctrl.enableZoom = true;
			ctrl.enableTilt = true;
			ctrl.enableLook = true;
		}
	}

	// Remove roaming area visual entities (rectangle fill + outline) from the scene
	function removeRoamingAreaVisuals() {
		if (cesiumViewer) {
			if (roamingAreaRectangle) {
				cesiumViewer.entities.remove(roamingAreaRectangle);
				roamingAreaRectangle = null;
			}
			if (roamingAreaOutline) {
				cesiumViewer.entities.remove(roamingAreaOutline);
				roamingAreaOutline = null;
			}
		}
	}

	// Function to cancel painting mode
	function cancelPaintingMode() {
		// Re-enable camera controls
		enableCameraControls();
		
		// Clear painting state
		roamingAreaStart = null;
		
		// Remove any existing entities
		if (roamingAreaEntity && cesiumViewer) {
			cesiumViewer.entities.remove(roamingAreaEntity);
			roamingAreaEntity = null;
		}

		// Remove roaming area visuals (rectangle + outline)
		removeRoamingAreaVisuals();
		
		// Exit painting mode
		isRoamingAreaMode.set(false);
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
	  
	  // Set the viewer in the store
	  viewer.set(cesiumViewer);

	  // Remap touch gestures: pinch only zooms, tilt is desktop-only (middle-drag / Ctrl+drag).
	  // Custom touchTiltHandler provides mobile tilt via two-finger parallel drag.
	  const sscc = cesiumViewer.scene.screenSpaceCameraController;
	  sscc.tiltEventTypes = [
		Cesium.CameraEventType.MIDDLE_DRAG,
		{ eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
	  ];
	  sscc.zoomEventTypes = [
		Cesium.CameraEventType.WHEEL,
		Cesium.CameraEventType.PINCH,
	  ];
	  sscc.zoomFactor = 15.0;

	  // Pitch clamp: prevent the camera from ever crossing the horizon
	  cesiumViewer.scene.preRender.addEventListener(() => {
		if (!cesiumViewer) return;
		const cam = cesiumViewer.camera;
		if (cam.pitch > CesiumMath.toRadians(-5)) {
		  cam.setView({ orientation: { heading: cam.heading, pitch: CesiumMath.toRadians(-5), roll: 0 } });
		}
	  });

	  // Wire up custom mobile tilt handler (two-finger parallel drag)
	  setupTouchTiltHandler(cesiumViewer);


	// Render the Cesium Container background transparent
	  cesiumViewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;

	// Remove the doubleclick event handler
	  cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  
	  // Set up real-time camera monitoring
		cesiumViewer.camera.moveStart.addEventListener(() => {
		  // Start monitoring when camera starts moving
		  startCameraMonitoring();
		});

		cesiumViewer.camera.moveEnd.addEventListener(() => {
		  // Stop monitoring when camera stops moving
		  stopCameraMonitoring();
		});
  
	  // Set initial camera position to 10 billion meters (unseen distance)
	  cesiumViewer.scene.camera.setView({
		destination: Cartesian3.fromDegrees(0, 0, 10000000000), // 10 billion meters
		orientation: {
		  heading: 0,
		  pitch: -CesiumMath.PI_OVER_TWO,
		  roll: 0,
		},
	  });

	  // Start location tracking (entities created once initial load completes)
	  startUserLocationTracking();

	  // Initialize height display
	  updateHeightDisplay();
	  
	  // Start loading assets in the background
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
	        pointEntity = addPickedPointMarker(cesiumViewer, clamped, pointEntity);
	      });
	      flyToLocation.set(null);
	    }
	  });

	  // Load city data from local JSON with optimized performance for all 1200 cities
	  try {
		const response = await fetch('/cities.json');
		if (!response.ok) {
		  throw new Error(`Failed to fetch cities: ${response.status}`);
		}
		const cities = await response.json();

		// Add label collection to scene with proper cleanup reference
		const labels = cesiumViewer.scene.primitives.add(new Cesium.LabelCollection());
		
		// Store labels reference for cleanup
		(window as any).cityLabels = labels;

		// Load all 1200 cities as requested
		const sample = cities.slice(0, 1200);

		// Simple, clean city loading
		sample.forEach((city: any) => {
		  const lat = parseFloat(city.lat);
		  const lon = parseFloat(city.lng);

		  if (isNaN(lat) || isNaN(lon)) return;

		  labels.add({
			position: Cesium.Cartesian3.fromDegrees(lon, lat),
			text: city.name,
			font: "24px sans-serif",
			fillColor: Cesium.Color.WHITE,
			outlineColor: Cesium.Color.BLACK,
			outlineWidth: 2,
			style: Cesium.LabelStyle.FILL_AND_OUTLINE,
			scaleByDistance: new Cesium.NearFarScalar(1.0, 1.0, 2.0e7, 0.0),
			eyeOffset: new Cesium.Cartesian3(0.0, 0.0, -12500),
		  });
		});
	  } catch (error) {
		console.error('Failed to load cities:', error);
		// Continue without cities if loading fails
	  }
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
  if (!loc || !cesiumViewer) return;
  flyToLonLat(cesiumViewer, loc.longitude, loc.latitude, 2000, 1.5);
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

  pointEntity = addPickedPointMarker(cesiumViewer, coords.cartesian, pointEntity);
}








  


	onDestroy(() => {
		// Unsubscribe flyToLocation
		if (unsubFlyTo) unsubFlyTo();

		// Stop camera monitoring
		stopCameraMonitoring();

		// Clean up custom mobile tilt handler
		destroyTouchTiltHandler();
		
		// Stop roaming animation
		stopRoamingAnimation();
		
		if (escapeKeyHandler) {
			window.removeEventListener('keydown', escapeKeyHandler);
			escapeKeyHandler = null;
		}
		
		// Clean up Cesium viewer and resources
		if (cesiumViewer) {
			// Remove all data sources
			cesiumViewer.dataSources.removeAll();
			
			// Remove all entities
			cesiumViewer.entities.removeAll();
			
			// Remove all primitives (including city labels)
			cesiumViewer.scene.primitives.removeAll();
			
			// Remove event handlers
			if (cesiumViewer.screenSpaceEventHandler) {
				cesiumViewer.screenSpaceEventHandler.destroy();
			}

			// Destroy the viewer
			cesiumViewer.destroy();
			viewer.set(null);
		}
		
		// Clean up data sources
		if (modelDataSource) {
			modelDataSource.entities.removeAll();
			modelDataSource = null;
		}
		
		// Clean up city labels reference
		if ((window as any).cityLabels) {
			(window as any).cityLabels = null;
		}
		
		// Clean up tracked object URLs to prevent memory leaks
		createdObjectURLs.forEach(url => URL.revokeObjectURL(url));
		createdObjectURLs = [];
  
		// Clear stores using the cleanup function
		resetAllStores();
		
		// Reset state variables
		modalService.closeAllModals();
		
		// Clean up roaming area state
		roamingAreaStart = null;
		roamingAreaEntity = null;
		roamingAreaRectangle = null;
		roamingAreaOutline = null;
		pointEntity = null;
		userLocationEntity = null;
		userRingEntities = [];
		userLocationInitialized = false;
		showRadialMenu = false;
		for (const key of Object.keys(layerEntities)) {
			removeMarkers(cesiumViewer, layerEntities[key]);
			layerEntities[key] = [];
		}
		stopUserLocationTracking();
		isMonitoringCamera = false;
		animationFrameId = null;
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
	animation: fade-in 3s ease-in-out forwards; /* Apply the fade-in animation */
	animation-delay: 4s;
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
</style>
  