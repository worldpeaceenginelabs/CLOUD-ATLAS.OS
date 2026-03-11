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
import LocationPicker from './components/LocationPicker.svelte';
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
		isPathDrawingMode,
		pathWaypoints,
		pathPaintSignal,
		pathCancelSignal,
		pathClearSignal,
		isSimulationRunning,
		simulationEntityCount,
		userLiveLocation,
		flyToLocation,
		type LocationOptions
	} from './store';
	import type { ModelData } from './types';
	import { idb } from './idb';
	import { setSceneCallbacks } from './utils/modelUtils';
	import { modalService } from './utils/modalService';
	import { getCurrentTimeIso8601 } from './utils/timeUtils';
	import { logger } from './utils/logger';
	import { simulationEngine } from './utils/simulationEngine';
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
		isValidLonLat,
	} from './utils/cesiumHelpers';
	import { setupTouchTiltHandler, destroyTouchTiltHandler } from './utils/touchTiltHandler';
	import { hasActiveGigSession } from './gig/gigRecovery';
	import { getSharedNostr } from './services/nostrPool';
	import ListingDetail from './gig/ListingDetail.svelte';
	import RadialGigMenu from './components/RadialGigMenu.svelte';
import { preselectedGigVertical, showRadialGigMenu, layerListings, activeMapLayers, layerRefresh, gigRadialOrigin } from './store';
import { LISTING_VERTICALS, VERTICALS, type ListingVerticalConfig } from './gig/verticals';
	import type { Listing, GigVertical, ListingVertical } from './types';
	import { initUserLocation, type UserLocationHandle } from './utils/cesiumUserLocation';
	import { initCameraMonitor, type CameraMonitorHandle } from './utils/cesiumCamera';
	import { initRoamingArea, type RoamingAreaHandle } from './utils/cesiumRoamingArea';
	import { initPathDrawing, type PathDrawingHandle } from './utils/cesiumPathDrawing';
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

// Spatial address bar state
let addressLat = '';
let addressLon = '';

// Map layer state
const layerEntities: Record<string, Entity[]> = {};
let selectedListing: { listing: Listing; vertical: ListingVertical } | null = null;
let myNostrPk = '';

let escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

let flySeq = 0;

// Module handles (initialized in onMount)
let userLocation: UserLocationHandle;
let cameraMonitor: CameraMonitorHandle;
let roamingArea: RoamingAreaHandle;
let pathDrawing: PathDrawingHandle;

// Reactive roaming signals
$: if ($roamingPaintSignal) roamingArea?.disableCamera();
$: if ($roamingCancelSignal) roamingArea?.cancelPainting();
$: if ($roamingClearSignal) roamingArea?.removeVisuals();

// Reactive path drawing signals
$: if ($pathPaintSignal) pathDrawing?.disableCamera();
$: if ($pathCancelSignal) pathDrawing?.cancelDrawing();
$: if ($pathClearSignal) pathDrawing?.removeVisuals();

// Track created object URLs for proper cleanup (item 5)
let createdObjectURLs: string[] = [];

// Export preview model functions for parent component
export { addPreviewModelToScene, removePreviewModelFromScene, updatePreviewModelInScene, updateSimulationModel, hideOriginalModel, showOriginalModel };

// Simple coordinate presence flag for UI badges
  
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

		const isHerd = modelData.behavior?.type === 'herd';
		const { position, orientation } = modelPositionAndOrientation(modelData);

		// For herds the parent entity is the invisible canvas — don't render a model on it
		modelDataSource.entities.add({
			id: modelData.id,
			name: modelData.name,
			position,
			model: isHerd ? undefined : {
				uri: modelUri,
				scale: modelData.transform.scale,
				minimumPixelSize: 64,
				maximumScale: 20000,
				show: true,
			},
			orientation,
			description: modelData.description || '3D Model'
		});

		// Spawn one Cesium entity per herd member, all sharing the same GLB
		if (isHerd) {
			const herd = modelData.behavior as import('./types').HerdBehavior;
			for (const member of herd.members) {
				modelDataSource.entities.add({
					id: `${modelData.id}_${member.id}`,
					name: `${modelData.name} #${member.id.split('_').pop()}`,
					position,
					model: {
						uri: modelUri,
						scale: modelData.transform.scale * member.scale,
						minimumPixelSize: 32,
						maximumScale: 20000,
						show: true,
					},
					orientation,
				});
			}
			logger.info(`Herd added: ${modelData.name} (${herd.members.length} members)`, { component: 'Cesium', operation: 'addModel' });
		} else {
			logger.info(`Model added: ${modelData.name}`, { component: 'Cesium', operation: 'addModel' });
		}
		
		simulationEngine.addModel(modelData);
		simulationEntityCount.set(simulationEngine.entityCount);
		if (simulationEngine.entityCount > 0 && !$isSimulationRunning) {
			startSimulation();
		}
	} catch (error) {
		console.error('Error adding model to scene:', error);
	}
}

// Load all models from store
function loadModelsFromStore() {
	if (modelDataSource) {
		modelDataSource.entities.removeAll();
		simulationEngine.clearAll();
		$models.forEach(modelData => {
			addModelToScene(modelData);
		});
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
$: if (initialZoomComplete && !userLocationInitialized && $userLiveLocation && isValidLonLat($userLiveLocation.latitude, $userLiveLocation.longitude) && cesiumViewer && userLocation) {
	userLocationInitialized = true;
	const { latitude, longitude } = $userLiveLocation;
	const seq = ++flySeq;
	cesiumViewer.camera.flyTo({
		destination: Cartesian3.fromDegrees(longitude, latitude, 20000000),
		duration: 1.5,
		complete: async () => {
			if (!cesiumViewer || seq !== flySeq) return;
			const userPosition = await clampToSurface(longitude, latitude);
			if (!cesiumViewer || seq !== flySeq) return;
			const entities = userLocation.createRing('Your Location!', userPosition);
			entities.forEach(e => cesiumViewer!.entities.add(e));
			userLocationEntity = entities.find(e => e.id === 'Your Location!') || null;
			userRingEntities = entities;
		},
	});
}

// Reopen radial menu when signalled by back buttons in the gig panel
$: if ($showRadialGigMenu) {
	showRadialGigMenu.set(false);

	// Recentre camera on the original radial origin, then reopen via unified workflow
	if (cesiumViewer) {
		if ($gigRadialOrigin === 'picked-point') {
			const centerEntity = cesiumViewer.entities.getById('pickedPoint');
			const pos = centerEntity?.position?.getValue(JulianDate.now());
			if (pos) {
				const carto = Cesium.Cartographic.fromCartesian(pos);
				const lat = CesiumMath.toDegrees(carto.latitude);
				const lon = CesiumMath.toDegrees(carto.longitude);
				if (isValidLonLat(lat, lon)) {
					flyToLocation.set({
						lat,
						lon,
						options: {
							openRadial: true,
							radialOrigin: 'picked-point',
							updateCoordinates: false,
							createPickedMarker: false,
						},
					});
				}
			}
		} else {
			const loc = $userLiveLocation;
			if (loc && isValidLonLat(loc.latitude, loc.longitude)) {
				flyToLocation.set({
					lat: loc.latitude,
					lon: loc.longitude,
					options: {
						openRadial: true,
						radialOrigin: 'user-location',
						updateCoordinates: false,
						createPickedMarker: false,
					},
				});
			}
		}
	}
}

/** Open radial menu centered on screen. */
function openRadialMenuCentered() {
	gigRadialOrigin.set('user-location');
	radialScreenX = window.innerWidth / 2;
	radialScreenY = window.innerHeight / 2;
	showRadialMenu = true;
}

/** Open radial menu centered on screen for the picked point. */
function openRadialMenuAtPickedPoint() {
	gigRadialOrigin.set('picked-point');
	radialScreenX = window.innerWidth / 2;
	radialScreenY = window.innerHeight / 2;
	showRadialMenu = true;
}

/** Open radial menu at picked point without moving the camera. */
function openRadialMenuAtPickedPointNoFly() {
	gigRadialOrigin.set('picked-point');
	radialScreenX = window.innerWidth / 2;
	radialScreenY = window.innerHeight / 2;
	showRadialMenu = true;
}

function handleAddressSelected(lat: string, lon: string, _displayName?: string) {
	addressLat = lat;
	addressLon = lon;
}

function applyPickedPoint(cartesian: Cartesian3, options?: LocationOptions) {
	if (!cesiumViewer) return;
	const carto = Cesium.Cartographic.fromCartesian(cartesian);
	const lon = CesiumMath.toDegrees(carto.longitude);
	const lat = CesiumMath.toDegrees(carto.latitude);

	const shouldUpdateCoords = options?.updateCoordinates ?? true;
	const shouldCreateMarker = options?.createPickedMarker ?? true;

	if (shouldUpdateCoords) {
		coordinates.set({
			latitude: lat.toFixed(10),
			longitude: lon.toFixed(10),
			height: carto.height,
		});
	}
	if (shouldCreateMarker) {
		pointEntities = addPickedPointMarker(cesiumViewer, cartesian, pointEntities);
	}

	const openRadial = options?.openRadial ?? true;
	if (openRadial) {
		if (options?.radialOrigin === 'user-location') {
			openRadialMenuCentered();
		} else {
			openRadialMenuAtPickedPointNoFly();
		}
	}
}

// Remove model from scene
function removeModelFromScene(modelId: string) {
	// Remove herd member entities before removing the parent
	const modelData = $models.find(m => m.id === modelId);
	if (modelData?.behavior?.type === 'herd') {
		for (const member of modelData.behavior.members) {
			removeEntityById(modelDataSource, `${modelId}_${member.id}`);
		}
	}

	removeEntityById(modelDataSource, modelId);
	simulationEngine.removeModel(modelId);
	simulationEntityCount.set(simulationEngine.entityCount);
}

function updateSimulationModel(modelData: ModelData) {
	simulationEngine.updateModel(modelData);
	simulationEntityCount.set(simulationEngine.entityCount);
	if (simulationEngine.entityCount > 0 && !$isSimulationRunning) {
		startSimulation();
	}
}

// ─── Simulation Engine Loop ──────────────────────────────────
let simulationFrameId: number | null = null;

function startSimulation() {
	if ($isSimulationRunning) return;
	isSimulationRunning.set(true);
	simulationEngine.start();
	animateSimulation();
	logger.info('Simulation started', { component: 'Cesium', operation: 'startSimulation' });
}

function stopSimulation() {
	if (!$isSimulationRunning) return;
	isSimulationRunning.set(false);
	simulationEngine.pause();
	if (simulationFrameId) {
		cancelAnimationFrame(simulationFrameId);
		simulationFrameId = null;
	}
}

// React to SimulationControls toggling the store from within the editor
let simStoreUnsub: (() => void) | null = null;
function initSimStoreWatch() {
	if (simStoreUnsub) return;
	simStoreUnsub = isSimulationRunning.subscribe(running => {
		if (running && !simulationFrameId && cesiumViewer) {
			simulationEngine.start();
			animateSimulation();
		} else if (!running && simulationFrameId) {
			simulationEngine.pause();
			cancelAnimationFrame(simulationFrameId);
			simulationFrameId = null;
		}
	});
}

function animateSimulation() {
	if (!$isSimulationRunning || !cesiumViewer || !modelDataSource) return;

	const updates = simulationEngine.tick();

	for (const update of updates) {
		const entity = modelDataSource.entities.getById(update.modelId);
		if (entity) {
			const newPosition = Cartesian3.fromDegrees(
				update.position.longitude,
				update.position.latitude,
				update.position.height
			);
			entity.position = newPosition as any;
			entity.orientation = Transforms.headingPitchRollQuaternion(
				newPosition,
				new HeadingPitchRoll(
					CesiumMath.toRadians(update.position.heading),
					0,
					0
				)
			) as any;
		}

		// Herd members: apply local offsets via ENU frame
		if (update.herdMembers && update.herdMembers.length > 0) {
			const canvasCartesian = Cartesian3.fromDegrees(
				update.position.longitude,
				update.position.latitude,
				update.position.height
			);
			const enu = Transforms.eastNorthUpToFixedFrame(canvasCartesian);
			const canvasHeading = CesiumMath.toRadians(update.position.heading);

			for (const member of update.herdMembers) {
				const memberEntity = modelDataSource.entities.getById(`${update.modelId}_${member.memberId}`);
				if (!memberEntity) continue;

				const cosH = Math.cos(canvasHeading);
				const sinH = Math.sin(canvasHeading);
				const rx = member.localX * cosH - member.localY * sinH;
				const ry = member.localX * sinH + member.localY * cosH;

				const offset = new Cartesian3(rx, ry, 0);
				const worldPos = Cesium.Matrix4.multiplyByPoint(enu, offset, new Cartesian3());

				memberEntity.position = worldPos as any;
				const memberHeading = canvasHeading + CesiumMath.toRadians(member.localHeading);
				memberEntity.orientation = Transforms.headingPitchRollQuaternion(
					worldPos,
					new HeadingPitchRoll(memberHeading, 0, 0)
				) as any;
			}
		}
	}

	simulationFrameId = requestAnimationFrame(animateSimulation);
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
			position: position as any,
			model: {
				uri: modelUri,
				scale: modelData.transform.scale,
				minimumPixelSize: 64,
				maximumScale: 20000,
				show: true,
			},
			orientation: orientation as any,
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
		entity.position = position as any;
		entity.name = modelData.name + ' (Preview)';
		entity.description = (modelData.description || '3D Model Preview') as any;
		if (entity.model) {
			(entity.model as any).uri = modelUri;
			(entity.model as any).scale = modelData.transform.scale;
		}
		entity.orientation = orientation as any;

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
		// Try map tiles once; if promise resolves add provider, else keep dark globe
		(async () => {
			try {
				const provider = await Cesium.createWorldImageryAsync();
				cesiumViewer.imageryLayers.addImageryProvider(provider);
			} catch {
				// leave dark globe as-is
			}
		})();
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
			if (event.key === 'Escape') {
				if ($isRoamingAreaMode) roamingArea.cancelPainting();
				if ($isPathDrawingMode) pathDrawing.cancelDrawing();
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

			if ($isPathDrawingMode) {
				pathDrawing.handleClick(click);
				return;
			}

			const pickedObject = cesiumViewer.scene.pick(click.position);

			if (Cesium.defined(pickedObject) && pickedObject.id) {
				const id = pickedObject.id.id;

				if (id === 'pickedPoint' || id?.startsWith('pickedPoint_')) {
					const centerEntity = cesiumViewer.entities.getById('pickedPoint');
					if (centerEntity && centerEntity.position) {
						const pos = centerEntity.position.getValue(JulianDate.now());
						if (pos) {
							const carto = Cesium.Cartographic.fromCartesian(pos);
							const lat = CesiumMath.toDegrees(carto.latitude);
							const lon = CesiumMath.toDegrees(carto.longitude);
							flyToLocation.set({
								lat,
								lon,
								options: {
									openRadial: true,
									radialOrigin: 'picked-point',
									updateCoordinates: false,
									createPickedMarker: false
								}
							});
						}
					}
					return;
				}

				if (id?.startsWith('Your Location!')) {
					const loc = $userLiveLocation;
					if (loc && isValidLonLat(loc.latitude, loc.longitude)) {
						flyToLocation.set({
							lat: loc.latitude,
							lon: loc.longitude,
							options: {
								openRadial: true,
								radialOrigin: 'user-location',
								updateCoordinates: false,
								createPickedMarker: false
							}
						});
					}
				} else if (trySelectListingEntity(pickedObject)) {
					// handled by trySelectListingEntity
				} else if (id?.startsWith('model_')) {
					let modelData = $models.find(model => model.id === id);
					if (!modelData && id.includes('_herd_member_')) {
						const parentId = id.substring(0, id.indexOf('_herd_member_'));
						modelData = $models.find(model => model.id === parentId);
					}
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
	initSimStoreWatch();
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

	  // Start with dark globe surface; map tiles load once below
	  cesiumViewer.imageryLayers.removeAll();
	  cesiumViewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#17181b');

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
	  pathDrawing = initPathDrawing(cesiumViewer, pathWaypoints, isPathDrawingMode);

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
	    if (loc && isValidLonLat(loc.lat, loc.lon) && cesiumViewer) {
	      const seq = ++flySeq;
	      const options = loc.options;
	      cesiumViewer.camera.flyTo({
	        destination: Cartesian3.fromDegrees(loc.lon, loc.lat, 2000),
	        duration: 1.5,
	        complete: async () => {
	          if (!cesiumViewer || seq !== flySeq) return;

	          const clamped = await clampToSurface(loc.lon, loc.lat);
	          if (!cesiumViewer || seq !== flySeq) return;
	          applyPickedPoint(clamped, options);

	          // Re-clamp user location rings to the ground after camera motion completes
	          const locStore = $userLiveLocation;
	          if (
	            userLocationInitialized &&
	            userRingEntities.length > 0 &&
	            locStore &&
	            isValidLonLat(locStore.latitude, locStore.longitude)
	          ) {
	            userLocation.updateRingPositions(
	              userRingEntities,
	              locStore.longitude,
	              locStore.latitude,
	            );
	          }
	        },
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
    idPrefix: cfg.mapPrefix,
    pointColor: cfg.color,
    getLabelText: (l) => wrapLabelEveryNChars(l.title || '?', 25),
    propertyKey: 'listing',
  });
}

function handleListingTakenDown(listingId: string) {
  if (!selectedListing) return;
  const v = selectedListing.vertical;
  const cfg = VERTICALS[v] as ListingVerticalConfig;
  const entities = layerEntities[v] ?? [];
  removeMarkerById(cesiumViewer, entities, cfg.mapPrefix, listingId);
  layerListings.update(all => ({
    ...all,
    [v]: (all[v] ?? []).filter(l => l.id !== listingId),
  }));
  layerRefresh.update(r => ({ ...r, [v]: (r[v] ?? 0) + 1 }));
  selectedListing = null;
}

let prevLayerSnapshot: Record<string, Listing[]> = {};
function sameList(a: Listing[], b: Listing[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => l.id === b[i]?.id);
}
$: {
  const all = $layerListings;
  const layersOn = $activeMapLayers;
  const nextSnapshot: Record<string, Listing[]> = {};
  for (const v of LISTING_VERTICALS) {
    const cur = layersOn.has(v) ? (all[v] ?? []) : [];
    const prev = prevLayerSnapshot[v] ?? [];
    if (!sameList(cur, prev) && initialZoomComplete) {
      onLayerChanged(v, cur);
    }
    nextSnapshot[v] = cur;
  }
  if (initialZoomComplete) {
    prevLayerSnapshot = nextSnapshot;
  }
}

function wrapLabelEveryNChars(text: string | null | undefined, max: number = 25): string {
  if (!text) return '?';
  const cleaned = text.trim();
  if (!cleaned) return '?';

  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      // start new line
      current = word;
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= max) {
      current = candidate;
    } else {
      // push current line and start a new one with this word
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines.join('\n');
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

  // Immediate UX: render marker + coords at the picked cartesian before flying
  applyPickedPoint(coords.cartesian, {
    openRadial: false,
    radialOrigin: 'picked-point',
  });

  // Then enqueue the usual fly + clamped re-render
  flyToLocation.set({
    lat: coords.latitude,
    lon: coords.longitude,
    options: {
      openRadial: false,
      radialOrigin: 'picked-point',
    },
  });
}

	onDestroy(() => {
		if (unsubFlyTo) unsubFlyTo();
		if (simStoreUnsub) simStoreUnsub();

		cameraMonitor?.cleanup();
		userLocation?.cleanup();
		roamingArea?.cleanup();
		pathDrawing?.cleanup();
		destroyTouchTiltHandler();
		stopSimulation();
		simulationEngine.clearAll();

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
  
  <!-- Spatial browser address bar (bottom left) -->
  <div class="addressbarcontainer">
    <LocationPicker
      lat={addressLat}
      lon={addressLon}
      placeholder="Search an address or place..."
      openRadialOnSelect={false}
      onLocationSelected={handleAddressSelected}
      onSelectedClick={() => {
        flyToLocation.set({
          lat: parseFloat(addressLat),
          lon: parseFloat(addressLon),
          options: {
            openRadial: false,
            radialOrigin: 'picked-point',
            updateCoordinates: false,
            createPickedMarker: false,
          },
        });
      }}
    />
  </div>

  <!-- MissionTV button (top left) -->
  <button class="mission-tv-btn" on:click={() => modalService.showMissionTV()} title="MissionTV">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
      <polyline points="17 2 12 7 7 2"/>
    </svg>
  </button>

  <!-- Layers button (top right) -->
  <button
    class="layers-menu-btn"
    on:click={() => modalService.toggleLayersMenu()}
    title="Layers"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </button>

  <!-- My Location button (bottom right) -->
  <button
    class="my-location-btn"
    on:click={() => {
      const loc = $userLiveLocation;
      if (loc && isValidLonLat(loc.latitude, loc.longitude)) {
        flyToLocation.set({
          lat: loc.latitude,
          lon: loc.longitude,
          options: {
            openRadial: false,
            radialOrigin: 'user-location',
            updateCoordinates: false,
            createPickedMarker: false,
          },
        });
      }
    }}
    title="My Location"
  >
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


	/* Spatial browser address bar (bottom left) – layout only; glass is on LocationPicker panels */
	.addressbarcontainer {
	  position: fixed;
	  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
	  left: 10px;
	  z-index: 1000;
	  max-width: 320px;
	  min-width: 220px;
	}

	/* My Location button (bottom right) */
	.my-location-btn {
	  position: fixed;
	  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
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

	/* MissionTV button (top left) */
	.mission-tv-btn {
	  position: absolute;
	  top: calc(20px + env(safe-area-inset-top, 0px));
	  left: 10px;
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

	.mission-tv-btn:hover {
	  background: rgba(255, 255, 255, 0.2);
	  transform: translateY(-2px);
	  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
	}

  /* Layers button (top right) */
  .layers-menu-btn {
    position: absolute;
    top: calc(20px + env(safe-area-inset-top, 0px));
    right: 10px;
    z-index: 1000;
    min-width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    padding: 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.2s;
  }

  .layers-menu-btn:hover {
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
  