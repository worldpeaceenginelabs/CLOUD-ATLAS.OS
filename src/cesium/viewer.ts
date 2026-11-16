import * as Cesium from 'cesium';
import {
  setupTouchTiltHandler,
  destroyTouchTiltHandler,
} from './touchTiltHandler';

/**
 * The single place that knows how to build (and tear down) a Cesium
 * Viewer. Everything about "what does the viewer look like" belongs
 * here, not in Cesium.svelte.
 *
 * Different applications can provide different viewer implementations
 * (viewerMinimal.ts, viewerSatellite.ts, ...) without touching the
 * Svelte component.
 */

export interface CreateViewerOptions extends Cesium.Viewer.ConstructorOptions {
  /** Optional Cesium Ion access token. */
  ionAccessToken?: string;
}

const DEFAULT_VIEWER_OPTIONS: Cesium.Viewer.ConstructorOptions = {
  animation: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  shouldAnimate: true,
  skyBox: false,
  sceneModePicker: false,
  baseLayerPicker: false,

  contextOptions: {
    webgl: {
      alpha: true,
    },
  },
};

/**
 * The viewer most recently created by createViewer() and not yet
 * destroyed. This is not a new registry: viewer.ts already declares
 * itself "the single place that knows how to build (and tear down) a
 * Cesium Viewer" — tracking what it built is that same responsibility,
 * kept entirely inside this file. Cesium.svelte is unaffected: it keeps
 * calling createViewer()/destroyViewer() exactly as before and never
 * touches this. Only cesium/api.ts reads it, via getActiveViewer().
 */
let activeViewer: Cesium.Viewer | undefined;
let globeReadyPromise: Promise<void> | undefined;

export function createViewer(
  container: Element | string,
  options: CreateViewerOptions = {}
): Cesium.Viewer {
  configureIon(options);

  const { ionAccessToken, ...viewerOptions } = options;

  const viewer = new Cesium.Viewer(container, {
    ...DEFAULT_VIEWER_OPTIONS,
    ...viewerOptions,

    // Cesium-Ion-Basiskarte vollständig deaktivieren
    baseLayer: false,
  });

  viewer.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  setupTouchTiltHandler(viewer);
  viewer.scene.screenSpaceCameraController.zoomFactor = 10.0;

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 10000000),
  });

  configureImagery(viewer);

  globeReadyPromise = new Promise((resolve) => {
    let loadingStarted = false;

    const removeListener =
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(
        (queuedTiles) => {
          if (queuedTiles > 0) {
            loadingStarted = true;
            return;
          }

          if (loadingStarted) {
            removeListener();
            resolve();
          }
        }
      );
  });

  configureScene(viewer);
  configureGlobe(viewer);
  configureRendering(viewer);

  activeViewer = viewer;

  return viewer;
}

export function destroyViewer(viewer: Cesium.Viewer): void {
  destroyTouchTiltHandler();

  if (!viewer.isDestroyed()) {
    viewer.destroy();
  }
  if (activeViewer === viewer) {
    activeViewer = undefined;
    globeReadyPromise = undefined;
  }
}

/** The current viewer, if createViewer() has been called and it hasn't been destroyed since. Used internally by cesium/api.ts. */
export function getActiveViewer(): Cesium.Viewer | undefined {
  return activeViewer;
}

export function waitForGlobeLoaded(): Promise<void> {
  return globeReadyPromise ?? Promise.resolve();
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function configureIon(options: CreateViewerOptions): void {
  const token = options.ionAccessToken || import.meta.env.VITE_ION_ACCESS_TOKEN;

  if (token) {
    Cesium.Ion.defaultAccessToken = token;
  }
}

/**
 * Imagery: NASA Blue Marble (offline, public/textures/blue-marble.jpg) from far away,
 * OpenStreetMap once the camera gets close. OSM fades in between
 * OSM_FADE_START_HEIGHT and OSM_FADE_END_HEIGHT (meters). While the
 * layer is fully transparent it is hidden, so no OSM tiles are requested
 * at app start.
 */
const OSM_FADE_START_HEIGHT = 3_000_000; // above: Blue Marble only
const OSM_FADE_END_HEIGHT = 80_000; // below: OSM only

function configureImagery(viewer: Cesium.Viewer): void {
  const layers = viewer.imageryLayers;

  // Base: NASA Blue Marble (offline, single world image in public/textures/)
  layers.add(
    Cesium.ImageryLayer.fromProviderAsync(
      Cesium.SingleTileImageryProvider.fromUrl(
        `${import.meta.env.BASE_URL}textures/blue-marble.jpg`,
        {
          credit: new Cesium.Credit(
            '<a href="https://visibleearth.nasa.gov/" target="_blank" rel="noopener">NASA Visible Earth</a>',
            true
          ),
        }
      )
    )
  );

  // Top: OpenStreetMap
  const osmLayer = layers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
      credit: new Cesium.Credit(
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
        true
      ),
    })
  );

  const updateOsmVisibility = () => {
    const height = viewer.camera.positionCartographic.height;
    // Logarithmic interpolation: zooming is exponential, so the blend
    // feels even across the whole range instead of front-loaded.
    const t = Cesium.Math.clamp(
      Math.log(OSM_FADE_START_HEIGHT / height) /
        Math.log(OSM_FADE_START_HEIGHT / OSM_FADE_END_HEIGHT),
      0,
      1
    );
    osmLayer.alpha = t;
    osmLayer.show = t > 0;
  };

  viewer.camera.percentageChanged = 0.01;
  viewer.camera.changed.addEventListener(updateOsmVisibility);
  updateOsmVisibility();
}

function configureScene(viewer: Cesium.Viewer): void {
  const { scene } = viewer;

  // Transparent canvas (lets the HTML background show through)
  scene.backgroundColor = Cesium.Color.TRANSPARENT;

  // Disable sky rendering
  scene.skyAtmosphere.show = false;
}

function configureGlobe(viewer: Cesium.Viewer): void {
  const { globe } = viewer.scene;

  globe.baseColor = Cesium.Color.fromCssColorString('#17181b');
  globe.enableLighting = true;
  globe.atmosphereLightIntensity = 20.0;
}

function configureRendering(viewer: Cesium.Viewer): void {
  viewer.scene.highDynamicRange = true;
}
