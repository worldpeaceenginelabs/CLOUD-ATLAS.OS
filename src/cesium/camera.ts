import * as Cesium from 'cesium';

/**
 * Camera helpers.
 *
 * Every function takes the Cesium.Viewer explicitly instead of relying on
 * module-level state, so this file has no notion of "the current viewer"
 * and can be used with any number of viewer instances.
 */

export interface FlyToTarget {
  longitude: number;
  latitude: number;
  /** Meters above the ellipsoid. Defaults to 1000. */
  height?: number;
  /** Radians. Defaults to facing north (0). */
  heading?: number;
  /** Radians. Defaults to looking straight down (-90deg). */
  pitch?: number;
  /** Radians. Defaults to 0. */
  roll?: number;
}

export interface CameraState {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

function toOrientation(target: FlyToTarget): {
  heading: number;
  pitch: number;
  roll: number;
} {
  return {
    heading: target.heading ?? 0,
    pitch: target.pitch ?? Cesium.Math.toRadians(-90),
    roll: target.roll ?? 0
  };
}

/** Animate the camera to a target position. Returns a promise that resolves on completion. */
export function flyTo(
  viewer: Cesium.Viewer,
  target: FlyToTarget,
  options: { duration?: number } = {}
): Promise<void> {
  return new Promise((resolve) => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
        target.height ?? 1000
      ),
      orientation: toOrientation(target),
      duration: options.duration,
      complete: () => resolve(),
      cancel: () => resolve()
    });
  });
}

/** Instantly set the camera position, with no animation. */
export function setView(viewer: Cesium.Viewer, target: FlyToTarget): void {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
      target.height ?? 1000
    ),
    orientation: toOrientation(target)
  });
}

/** Zoom in by a relative amount (meters). Positive values move the camera closer. */
export function zoomIn(viewer: Cesium.Viewer, amount?: number): void {
  viewer.camera.zoomIn(amount);
}

/** Zoom out by a relative amount (meters). Positive values move the camera further away. */
export function zoomOut(viewer: Cesium.Viewer, amount?: number): void {
  viewer.camera.zoomOut(amount);
}

/** Read the camera's current position/orientation as plain numbers. */
export function getCameraState(viewer: Cesium.Viewer): CameraState {
  const carto = viewer.camera.positionCartographic;
  return {
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
    height: carto.height,
    heading: viewer.camera.heading,
    pitch: viewer.camera.pitch,
    roll: viewer.camera.roll
  };
}

/** Fly the camera so that the given rectangle (degrees) fills the view. */
export function flyToRectangle(
  viewer: Cesium.Viewer,
  rectangle: { west: number; south: number; east: number; north: number },
  options: { duration?: number } = {}
): Promise<void> {
  return new Promise((resolve) => {
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        rectangle.west,
        rectangle.south,
        rectangle.east,
        rectangle.north
      ),
      duration: options.duration,
      complete: () => resolve(),
      cancel: () => resolve()
    });
  });
}
