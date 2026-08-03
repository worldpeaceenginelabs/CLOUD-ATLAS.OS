import * as Cesium from 'cesium';

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
  infoBox: true,
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

export function createViewer(
  container: Element | string,
  options: CreateViewerOptions = {}
): Cesium.Viewer {
  configureIon(options);

  const { ionAccessToken, ...viewerOptions } = options;

  const viewer = new Cesium.Viewer(container, {
    ...DEFAULT_VIEWER_OPTIONS,
    ...viewerOptions,
  });

  configureScene(viewer);
  configureGlobe(viewer);
  configureRendering(viewer);

  return viewer;
}

export function destroyViewer(viewer: Cesium.Viewer): void {
  if (!viewer.isDestroyed()) {
    viewer.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function configureIon(options: CreateViewerOptions): void {
  if (options.ionAccessToken) {
    Cesium.Ion.defaultAccessToken = options.ionAccessToken;
  }
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