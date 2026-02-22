import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import type { Writable } from 'svelte/store';
import { pickPositionToLonLat } from './cesiumHelpers';

export interface RoamingAreaHandle {
  handleClick(click: any): void;
  disableCamera(): void;
  enableCamera(): void;
  removeVisuals(): void;
  cancelPainting(): void;
  cleanup(): void;
}

export function initRoamingArea(
  viewer: Viewer,
  roamingAreaBounds: Writable<{ north: number; south: number; east: number; west: number } | null>,
  isRoamingAreaMode: Writable<boolean>,
): RoamingAreaHandle {
  let areaStart: { latitude: number; longitude: number } | null = null;
  let startEntity: Entity | null = null;
  let rectangleEntity: Entity | null = null;
  let outlineEntity: Entity | null = null;

  function handleClick(click: any) {
    const coords = pickPositionToLonLat(viewer, click.position);
    if (!coords) return;
    const { longitude, latitude, cartesian } = coords;

    if (!areaStart) {
      areaStart = { latitude, longitude };
      startEntity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      const bounds = {
        north: Math.max(areaStart.latitude, latitude),
        south: Math.min(areaStart.latitude, latitude),
        east: Math.max(areaStart.longitude, longitude),
        west: Math.min(areaStart.longitude, longitude),
      };

      roamingAreaBounds.set(bounds);

      if (startEntity) {
        viewer.entities.remove(startEntity);
        startEntity = null;
      }

      rectangleEntity = viewer.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            bounds.west, bounds.south, bounds.east, bounds.north,
          ),
          material: Cesium.Color.YELLOW.withAlpha(0.3),
          classificationType: Cesium.ClassificationType.BOTH,
        },
      });

      outlineEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            bounds.west, bounds.south,
            bounds.east, bounds.south,
            bounds.east, bounds.north,
            bounds.west, bounds.north,
            bounds.west, bounds.south,
          ]),
          width: 2,
          material: Cesium.Color.YELLOW,
          clampToGround: true,
        },
      });

      enableCamera();
      areaStart = null;
    }
  }

  function disableCamera() {
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.enableRotate = false;
    ctrl.enableTranslate = false;
    ctrl.enableZoom = false;
    ctrl.enableTilt = false;
    ctrl.enableLook = false;
  }

  function enableCamera() {
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.enableRotate = true;
    ctrl.enableTranslate = true;
    ctrl.enableZoom = true;
    ctrl.enableTilt = true;
    ctrl.enableLook = true;
  }

  function removeVisuals() {
    if (rectangleEntity) { viewer.entities.remove(rectangleEntity); rectangleEntity = null; }
    if (outlineEntity) { viewer.entities.remove(outlineEntity); outlineEntity = null; }
  }

  function cancelPainting() {
    enableCamera();
    areaStart = null;
    if (startEntity) { viewer.entities.remove(startEntity); startEntity = null; }
    removeVisuals();
    isRoamingAreaMode.set(false);
  }

  function cleanup() {
    areaStart = null;
    startEntity = null;
    rectangleEntity = null;
    outlineEntity = null;
  }

  return { handleClick, disableCamera, enableCamera, removeVisuals, cancelPainting, cleanup };
}
