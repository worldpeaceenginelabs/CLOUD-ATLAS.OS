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
	  Cartographic,
	} from 'cesium';
	import * as Cesium from 'cesium';
	import "cesium/Build/Cesium/Widgets/widgets.css";
	import { 
		coordinates, 
		models, 
		pins, 
		resetAllStores, 
		viewer,
		currentHeight,
		is3DTilesetActive,
		basemapProgress,
		tilesetProgress,
		isInitialLoadComplete,
		isRoamingAreaMode,
		roamingAreaBounds,
		isGigPickingDestination,
		userLiveLocation
	} from './store';
	import type { ModelData, PinData } from './types';
	import { dataManager } from './dataManager';
	import { modalService } from './utils/modalService';
import { getCurrentTimeIso8601 } from './utils/timeUtils';
import { logger } from './utils/logger';
import { roamingAnimationManager } from './utils/roamingAnimation';
import ScrollbarStyles from './components/ScrollbarStyles.svelte';
import MapLayersMenu from './components/MapLayersMenu.svelte';
import HelpoutDetail from './gig/HelpoutDetail.svelte';
import SocialDetail from './gig/SocialDetail.svelte';
import { getSharedNostr } from './services/nostrPool';
import type { Listing } from './types';
  
// Global variables and states
let customDataSource: CustomDataSource | null = new CustomDataSource('locationpins');
let modelDataSource: CustomDataSource | null = new CustomDataSource('models');
let pointEntity: Entity | null = null; // For coordinate picking
let userLocationEntity: Entity | null = null; // For user location on map
let userLocationInitialized = false; // Track if user location entity has been created
let geoWatchId: number | null = null; // For watchPosition cleanup
let isMonitoringCamera = false; // Track if camera monitoring is active
let animationFrameId: number | null = null; // For requestAnimationFrame
let tileset: Cesium3DTileset | null = null; // Global tileset reference
let isBasemapLoaded = false; // Local variable for basemap loading state
let isTilesetLoaded = false; // Local variable for tileset loading state
let cesiumViewer: any = null; // Global viewer reference

// Map layer state
let helpoutEntities: Entity[] = [];
let socialEntities: Entity[] = [];
let selectedHelpout: Listing | null = null;
let selectedSocial: Listing | null = null;
let myNostrPk = '';

// Roaming area painting state
let roamingAreaStart: { latitude: number; longitude: number } | null = null;
let roamingAreaEntity: Entity | null = null;
let roamingAreaRectangle: Entity | null = null;
let roamingAreaOutline: Entity | null = null;

// Stored event handler references for proper cleanup
let startRoamingHandler: (() => void) | null = null;
let escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

// Track created object URLs for proper cleanup (item 5)
let createdObjectURLs: string[] = [];

// Roaming animation state
let roamingAnimationFrameId: number | null = null;
let isRoamingAnimationActive = false;

// Export preview model functions for parent component
export { addPreviewModelToScene, removePreviewModelFromScene, updatePreviewModelInScene, updateRoamingModel, hideOriginalModel, showOriginalModel };
  
	// Initialize data manager
	const initializeDataManager = async (): Promise<void> => {
		// Set up callbacks for the data manager
		dataManager.callbacks = {
			addModelToScene: addModelToScene,
			removeModelFromScene: removeModelFromScene,
			addPinToScene: addRecordToMap,
			removePinFromScene: removeRecordFromMap
		};
  
		await dataManager.initialize();
	};
  
	// Load all data using streamlined data manager
	const loadAllData = async () => {
		if (customDataSource) {
			customDataSource.entities.removeAll();
		}
		if (modelDataSource) {
			modelDataSource.entities.removeAll();
		}
  
		try {
			const { models: loadedModels, pins: loadedPins } = await dataManager.loadAllData();
			
			// Update stores with loaded data
			models.set(loadedModels);
			pins.set(loadedPins);
			
			logger.dataLoaded('models', loadedModels.length);
			logger.dataLoaded('pins', loadedPins.length);
		} catch (error) {
			console.error('Error loading data:', error);
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
	  if (!cesiumViewer) return new Entity();
	  
	  const start = JulianDate.now();
	  const mid = JulianDate.addSeconds(start, 0.5, new JulianDate());
	  const stop = JulianDate.addSeconds(start, 2, new JulianDate());
  
	  cesiumViewer.clock.startTime = start;
	  cesiumViewer.clock.currentTime = start;
	  cesiumViewer.clock.stopTime = stop;
	  cesiumViewer.clock.clockRange = ClockRange.LOOP_STOP;
  
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
  
	// Start user location tracking (single watchPosition handles both initial placement and live updates)
	const startUserLocationTracking = (silent = false) => {
	  if (!navigator.geolocation || !cesiumViewer) return;
	  if (geoWatchId !== null) return; // already tracking

	  geoWatchId = navigator.geolocation.watchPosition(
		(position) => {
		  const { latitude, longitude } = position.coords;
		  userLiveLocation.set({ latitude, longitude });

		  if (!userLocationInitialized) {
			userLocationInitialized = true;
			// Sample terrain/tileset height at GPS coordinates (same approach as pickPosition for pins)
			const cartographic = Cartographic.fromDegrees(longitude, latitude);
			const sampledHeight = cesiumViewer!.scene.sampleHeight(cartographic);
			const height = sampledHeight !== undefined ? sampledHeight : 0;
			const userPosition = Cartesian3.fromDegrees(longitude, latitude, height);
			userLocationEntity = createPulsatingPoint('Your Location!', userPosition, Cesium.Color.BLUE);
			userLocationEntity.show = !silent;
			cesiumViewer!.entities.add(userLocationEntity);
			return;
		  }

		  // All subsequent updates: move the dot
		  if (userLocationEntity && cesiumViewer) {
			// Resample terrain/tileset height on each GPS update
			const cartographic = Cartographic.fromDegrees(longitude, latitude);
			const sampledHeight = cesiumViewer.scene.sampleHeight(cartographic);
			const height = sampledHeight !== undefined ? sampledHeight : 0;
			(userLocationEntity.position as any) = Cartesian3.fromDegrees(longitude, latitude, height);
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

	// Show the user location entity and fly to it
	const showUserLocation = () => {
	  if (userLocationEntity && cesiumViewer) {
		userLocationEntity.show = true;
		const position = userLocationEntity.position?.getValue(JulianDate.now());
		if (position) {
		  cesiumViewer.camera.flyTo({
			destination: Cartesian3.fromDegrees(
			  CesiumMath.toDegrees(Cartographic.fromCartesian(position).longitude),
			  CesiumMath.toDegrees(Cartographic.fromCartesian(position).latitude),
			  20000000.0
			),
		  });
		}
	  }
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
		
		// Check if we need to switch between globe and 3D tileset
		if (height > 6000000) {
			// Show the base layer and hide the 3D tileset
			if ($is3DTilesetActive) {
				cesiumViewer.scene.globe.show = true;
				if (tileset) tileset.show = false;
				is3DTilesetActive.set(false);
				// Hide location pins and 3D models when using base layer
				if (customDataSource) customDataSource.show = false;
				if (modelDataSource) modelDataSource.show = false;
			}
		} else {
			// Hide the base layer and show the 3D tileset
			if (!$is3DTilesetActive) {
				cesiumViewer.scene.globe.show = false;
				if (tileset) tileset.show = true;
				is3DTilesetActive.set(true);
				// Show location pins and 3D models when using 3D tileset
				if (customDataSource) customDataSource.show = true;
				if (modelDataSource) modelDataSource.show = true;
				// Data is already preloaded during initialization
			}
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
			// Check if file is a File object or a URL string (from IndexedDB)
			if (modelData.file instanceof File) {
				modelUri = URL.createObjectURL(modelData.file);
				createdObjectURLs.push(modelUri);
			} else {
				// It's a URL string from IndexedDB
				modelUri = modelData.file as string;
			}
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

		logger.modelAdded(modelData.name);
		
		// Add to roaming animation if enabled
		if (modelData.roaming?.isEnabled) {
			roamingAnimationManager.addModel(modelData);
			
			// Start roaming animation if not already running
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

// Remove model from scene
function removeModelFromScene(modelId: string) {
	if (modelDataSource) {
		const entity = modelDataSource.entities.getById(modelId);
		if (entity) {
			modelDataSource.entities.remove(entity);
		}
	}
	
	// Remove from roaming animation if active
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
			if (modelData.file instanceof File) {
				modelUri = URL.createObjectURL(modelData.file);
				createdObjectURLs.push(modelUri);
			} else {
				modelUri = modelData.file as string;
			}
		} else if (modelData.source === 'url' && modelData.url) {
			modelUri = modelData.url;
		} else {
			console.error('Invalid model source or missing URL/file for preview');
			return;
		}

		// Create the preview model entity
		if (!previewModelDataSource) {
			return;
		}
		
		const entity = previewModelDataSource.entities.add({
			id: modelData.id,
			name: modelData.name + ' (Preview)',
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
		const entity = previewModelDataSource.entities.getById(currentPreviewModelId);
		if (entity) {
			previewModelDataSource.entities.remove(entity);
		}
		
		// Show the original model again
		showOriginalModel(currentPreviewModelId);
		
		currentPreviewModelId = null;
		logger.info('Preview model removed from scene', { component: 'Cesium', operation: 'removePreviewModel' });
	}
}

// Hide original model when in preview mode
function hideOriginalModel(modelId: string) {
	if (modelDataSource) {
		const entity = modelDataSource.entities.getById(modelId);
		if (entity && entity.model) {
			entity.model.show = false;
			logger.info('Original model hidden for preview: ' + modelId, { component: 'Cesium', operation: 'hideOriginalModel' });
		}
	}
}

// Show original model when exiting preview mode
function showOriginalModel(modelId: string) {
	if (modelDataSource) {
		const entity = modelDataSource.entities.getById(modelId);
		if (entity && entity.model) {
			entity.model.show = true;
			logger.info('Original model shown: ' + modelId, { component: 'Cesium', operation: 'showOriginalModel' });
		}
	}
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

		// Update the existing entity
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
			if (modelData.file instanceof File) {
				modelUri = URL.createObjectURL(modelData.file);
				createdObjectURLs.push(modelUri);
			} else {
				modelUri = modelData.file as string;
			}
		} else if (modelData.source === 'url' && modelData.url) {
			modelUri = modelData.url;
		} else {
			console.error('Invalid model source or missing URL/file for preview update');
			return;
		}

		// Update entity properties
		entity.position = position;
		entity.name = modelData.name + ' (Preview)';
		entity.description = modelData.description || '3D Model Preview';
		
		if (entity.model) {
			entity.model.uri = modelUri;
			entity.model.scale = modelData.transform.scale;
		}
		
		entity.orientation = Transforms.headingPitchRollQuaternion(
			position,
			new HeadingPitchRoll(heading, pitch, roll)
		);

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
		// Load basemap (globe) with progress
		loadBasemapWithProgress();
		
		// Load 3D tileset with progress
		loadTilesetWithProgress();
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
			// Zoom to 20 million meters
			cesiumViewer.camera.flyTo({
				destination: Cartesian3.fromDegrees(0, 0, 20000000),
				duration: 3.0
			});
			
			// Show user location after zoom animation completes
			setTimeout(() => {
				showUserLocation();
			}, 3000); // 3.0 seconds to allow for 3-second zoom duration
		}
	}

	// Function to fetch record from data manager
	async function fetchRecord(mapid: string) {
		try {
			const pins = await dataManager.getPins();
			return pins.find((pin: PinData) => pin.mapid === mapid) || null;
		} catch (error) {
			console.error('Error fetching record:', error);
			return null;
		}
	}

	// Function to set up event handlers
	function setupEventHandlers() {
		if (!cesiumViewer) return;

		// Listen for cancel painting mode event
		window.addEventListener('cancelRoamingAreaPainting', cancelPaintingMode);
		
		// Listen for clear roaming area visuals event (from Roaming.svelte and modelEditorService)
		window.addEventListener('clearRoamingAreaVisuals', removeRoamingAreaVisuals);
		
		// Listen for start painting mode event (store reference for cleanup)
		startRoamingHandler = () => { disableCameraControls(); };
		window.addEventListener('startRoamingAreaPainting', startRoamingHandler);
		
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

		// Combined event handler for picking entities and coordinates
		cesiumViewer.screenSpaceEventHandler.setInputAction(debounce(async function(click: any) {
			if (!cesiumViewer) return;
			
			// Check if we're in roaming area painting mode
			if ($isRoamingAreaMode) {
				handleRoamingAreaClick(click);
				return;
			}

			const pickedObject = cesiumViewer.scene.pick(click.position);

			// If an object is picked, handle entity picking
			if (Cesium.defined(pickedObject) && pickedObject.id) {
				if (pickedObject.id.id === "pickedPoint") {
					// Ignore clicks on the picked point marker
				} else if (pickedObject.id.id === "Your Location!") {
				// Open Gig Economy when user clicks the blue location dot
				modalService.showGigEconomy();
				// Fly camera to 2000m above the user's location
				const position = pickedObject.id.position?.getValue(JulianDate.now());
				if (position && cesiumViewer) {
					const cartographic = Cartographic.fromCartesian(position);
					cesiumViewer.camera.flyTo({
						destination: Cartesian3.fromDegrees(
							CesiumMath.toDegrees(cartographic.longitude),
							CesiumMath.toDegrees(cartographic.latitude),
							2000
						),
					});
				}
				} else if (pickedObject.id && pickedObject.id.id.startsWith('helpout_')) {
				// Handle helpout marker click
				const props = pickedObject.id.properties;
				if (props && props.helpoutListing) {
					selectedHelpout = props.helpoutListing.getValue(JulianDate.now());
				}
			} else if (pickedObject.id && pickedObject.id.id.startsWith('social_')) {
				// Handle social marker click
				const props = pickedObject.id.properties;
				if (props && props.socialListing) {
					selectedSocial = props.socialListing.getValue(JulianDate.now());
				}
				} else if (pickedObject.id && pickedObject.id.id.startsWith('model_')) {
					// Handle 3D model click
					const modelId = pickedObject.id.id;
					const modelData = $models.find(model => model.id === modelId);
					if (modelData) {
						modalService.showModelDetails(modelData);
					}
				} else {
					await handleEntityPick(pickedObject);
				}
			} else {
				// If no object is picked, handle coordinate picking
				// Skip zoom modal during roaming area painting or gig destination picking
				if (!$isRoamingAreaMode) {
					if ($isGigPickingDestination) {
						// Gig economy destination picking — bypass zoom restriction
						handleCoordinatePick(click);
					} else {
						const height = cesiumViewer.camera.positionCartographic.height;
						if (height > 250000) {
							// Show the zoom modal
							modalService.showZoomRequired();
							// Auto-hide after 3 seconds
							setTimeout(() => {
								modalService.hideZoomRequired();
							}, 3000);
						} else {
							handleCoordinatePick(click);
						}
					}
				}
			}
		}, 300), Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}

	// Function to handle roaming area painting clicks
	function handleRoamingAreaClick(click: any) {
		if (!cesiumViewer) return;
		
		const cartesian = cesiumViewer.scene.pickPosition(click.position);
		if (!cartesian) return;

		const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
		const longitude = Cesium.Math.toDegrees(cartographic.longitude);
		const latitude = Cesium.Math.toDegrees(cartographic.latitude);
		
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
			
			// Dispatch event to notify the Roaming component
			window.dispatchEvent(new CustomEvent('roamingAreaBounds', { 
				detail: bounds 
			}));
			
			// Re-enable camera controls
			enableCameraControls();
			
			// Reset for next area
			roamingAreaStart = null;
		}
	}

	// Function to disable camera controls
	function disableCameraControls() {
		if (cesiumViewer) {
			cesiumViewer.scene.screenSpaceCameraController.enableRotate = false;
			cesiumViewer.scene.screenSpaceCameraController.enableTranslate = false;
			cesiumViewer.scene.screenSpaceCameraController.enableZoom = false;
		}
	}

	// Function to re-enable camera controls
	function enableCameraControls() {
		if (cesiumViewer) {
			cesiumViewer.scene.screenSpaceCameraController.enableRotate = true;
			cesiumViewer.scene.screenSpaceCameraController.enableTranslate = true;
			cesiumViewer.scene.screenSpaceCameraController.enableZoom = true;
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

	// Note: Reactive statements removed - data flow is now handled by explicit function calls
	// Data flow: UI → Store → IDB → Scene (via dataManager functions)t


  
	// Initialization on mount
	onMount(async () => {
	Ion.defaultAccessToken = import.meta.env.VITE_ION_ACCESS_TOKEN;
	// FOR LIVE EDIT: Ion.defaultAccessToken = 'yourtoken';
	// TO USE THE GLOBE IN LIVE EDIT GET A FREE API KEY AT https://ion.cesium.com/

	  
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

	  // Start location tracking (entity hidden until initial load completes)
	  startUserLocationTracking(true);

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
	  initializeDataManager()
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
	  
  
	  // Set up clustering for the custom data source
	  if (customDataSource) {
		  customDataSource.clustering.enabled = true;
		  customDataSource.clustering.pixelRange = 10;
		  customDataSource.clustering.minimumClusterSize = 2;
	  }
  
	  if (customDataSource) cesiumViewer.dataSources.add(customDataSource);
	  if (modelDataSource) cesiumViewer.dataSources.add(modelDataSource);

	  // Set up event handlers for user interactions
	  setupEventHandlers();

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

	// This block handles user interactions with the Cesium viewer, including picking entities and coordinates.

// Function to handle entity picking
async function handleEntityPick(pickedFeature: any) {
  if (!pickedFeature || !pickedFeature.id) return;

  const entityId = pickedFeature.id.id;
  const mapid = entityId.replace(/(_image)$/, '');

  try {
    const record = await fetchRecord(mapid);
    if (record) {
      modalService.showRecordDetails(record as PinData);
    }
  } catch (error) {
    console.error('Error fetching record:', error);
  }
}

// ─── Helpout Map Layer ──────────────────────────────────────

/** Add helpout listing markers to the Cesium globe. */
function renderHelpoutMarkers(listings: Listing[]) {
  removeHelpoutMarkers();
  if (!cesiumViewer) return;

  for (const listing of listings) {
    if (!listing.location) continue;
    const position = Cartesian3.fromDegrees(
      listing.location.longitude,
      listing.location.latitude,
      0
    );

    const entity = cesiumViewer.entities.add({
      id: `helpout_${listing.id}`,
      position,
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString('#00BCD4'),
        outlineColor: Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: '?',
        font: 'bold 12px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: { helpoutListing: listing },
    });
    helpoutEntities.push(entity);
  }
}

/** Remove all helpout markers from the globe. */
function removeHelpoutMarkers() {
  if (!cesiumViewer) return;
  for (const entity of helpoutEntities) {
    cesiumViewer.entities.remove(entity);
  }
  helpoutEntities = [];
}

/** Handle MapLayersMenu callback for helpouts. */
async function onHelpoutsChanged(listings: Listing[]) {
  if (listings.length === 0) {
    removeHelpoutMarkers();
    return;
  }
  await ensureMyPk();
  renderHelpoutMarkers(listings);
}

/** Remove a single helpout marker by listing ID (after take-down). */
function handleHelpoutTakenDown(listingId: string) {
  if (!cesiumViewer) return;
  const entityId = `helpout_${listingId}`;
  const idx = helpoutEntities.findIndex(e => e.id === entityId);
  if (idx !== -1) {
    cesiumViewer.entities.remove(helpoutEntities[idx]);
    helpoutEntities.splice(idx, 1);
  }
}

// ─── Social Map Layer ───────────────────────────────────────

/** Add social listing markers to the Cesium globe. */
function renderSocialMarkers(listings: Listing[]) {
  removeSocialMarkers();
  if (!cesiumViewer) return;

  for (const listing of listings) {
    if (!listing.location) continue;
    const position = Cartesian3.fromDegrees(
      listing.location.longitude,
      listing.location.latitude,
      0
    );

    const entity = cesiumViewer.entities.add({
      id: `social_${listing.id}`,
      position,
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString('#FF4081'),
        outlineColor: Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: listing.title || '★',
        font: 'bold 12px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: { socialListing: listing },
    });
    socialEntities.push(entity);
  }
}

/** Remove all social markers from the globe. */
function removeSocialMarkers() {
  if (!cesiumViewer) return;
  for (const entity of socialEntities) {
    cesiumViewer.entities.remove(entity);
  }
  socialEntities = [];
}

/** Handle MapLayersMenu callback for social. */
async function onSocialChanged(listings: Listing[]) {
  if (listings.length === 0) {
    removeSocialMarkers();
    return;
  }
  await ensureMyPk();
  renderSocialMarkers(listings);
}

/** Remove a single social marker by listing ID (after take-down). */
function handleSocialTakenDown(listingId: string) {
  if (!cesiumViewer) return;
  const entityId = `social_${listingId}`;
  const idx = socialEntities.findIndex(e => e.id === entityId);
  if (idx !== -1) {
    cesiumViewer.entities.remove(socialEntities[idx]);
    socialEntities.splice(idx, 1);
  }
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

// Function to handle coordinate picking

function handleCoordinatePick(result: any) {
  if (!cesiumViewer) return;
  
  // When picking destination for gig economy, skip zoom check and pin billboard
  const isGigPicking = $isGigPickingDestination;
  
  if (!isGigPicking) {
    // Check camera height before allowing pin placement
    const cameraHeight = cesiumViewer.camera.positionCartographic.height;
    if (cameraHeight > 250000) {
      // Show the zoom modal if trying to place pin from too high
      modalService.showZoomRequired();
      // Auto-hide after 3 seconds
      setTimeout(() => {
        modalService.hideZoomRequired();
      }, 3000);
      return; // Prevent pin placement
    }
  }
  
  const cartesian = cesiumViewer.scene.pickPosition(result.position);
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

  // Skip pin billboard when picking for gig economy
  if (isGigPicking) return;

  if (pointEntity && cesiumViewer) {
    cesiumViewer.entities.remove(pointEntity);
  }

  if (cesiumViewer) {
    pointEntity = cesiumViewer.entities.add({
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








  


	onDestroy(() => {
		// Stop camera monitoring
		stopCameraMonitoring();
		
		// Stop roaming animation
		stopRoamingAnimation();
		
		// Remove event listeners
		window.removeEventListener('cancelRoamingAreaPainting', cancelPaintingMode);
		window.removeEventListener('clearRoamingAreaVisuals', removeRoamingAreaVisuals);
		if (startRoamingHandler) {
			window.removeEventListener('startRoamingAreaPainting', startRoamingHandler);
			startRoamingHandler = null;
		}
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
		if (customDataSource) {
			customDataSource.entities.removeAll();
			customDataSource = null;
		}
		
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
		userLocationInitialized = false;
		removeHelpoutMarkers();
		stopUserLocationTracking();
		isMonitoringCamera = false;
		animationFrameId = null;
	});


  </script>
  

  
<ScrollbarStyles />
<div style="width: 100%; display: flex; justify-content: center; align-items: center; position: relative;">
  <main id="cesiumContainer"></main>
  
  
  <!-- Height Display (bottom left) -->
  <div class="height-display">
    <div class="height-label">Height:</div>
    <div class="height-value">{Math.round($currentHeight / 1000)}km</div>
  </div>

  <!-- Map Layers Menu (bottom right) -->
  <MapLayersMenu {onHelpoutsChanged} {onSocialChanged} />
</div>

<!-- Helpout Detail Overlay (shown on marker click) -->
{#if selectedHelpout}
  <HelpoutDetail
    listing={selectedHelpout}
    myPk={myNostrPk}
    onClose={() => selectedHelpout = null}
    onTakenDown={handleHelpoutTakenDown}
  />
{/if}

<!-- Social Detail Overlay (shown on marker click) -->
{#if selectedSocial}
  <SocialDetail
    listing={selectedSocial}
    myPk={myNostrPk}
    onClose={() => selectedSocial = null}
    onTakenDown={handleSocialTakenDown}
  />
{/if}  







<style>
	main {
	  width: 100%;
	  height: 100vh;
	  margin: 0;
	  padding: 0;
	}


	/* Height display (bottom left) */
	.height-display {
	  position: absolute;
	  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
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


/* Scrollbar styles provided by ScrollbarStyles component */
</style>
  