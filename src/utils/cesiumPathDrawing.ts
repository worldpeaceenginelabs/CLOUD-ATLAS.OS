/**
 * Path Drawing Handler
 *
 * Allows the user to click multiple points on the map to define
 * a path (waypoint sequence). Mirrors the pattern of cesiumRoamingArea.ts.
 */

import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import type { Writable } from 'svelte/store';
import type { LatLon } from '../types';
import { pickPositionToLonLat } from './cesiumHelpers';

export interface PathDrawingHandle {
  handleClick(click: any): void;
  disableCamera(): void;
  enableCamera(): void;
  removeVisuals(): void;
  cancelDrawing(): void;
  cleanup(): void;
}

export function initPathDrawing(
  viewer: Viewer,
  pathWaypoints: Writable<LatLon[]>,
  isPathDrawingMode: Writable<boolean>,
): PathDrawingHandle {
  let waypointEntities: Entity[] = [];
  let lineEntity: Entity | null = null;
  let waypoints: LatLon[] = [];

  function handleClick(click: any) {
    const coords = pickPositionToLonLat(viewer, click.position);
    if (!coords) return;
    const { longitude, latitude, cartesian } = coords;

    waypoints.push({ latitude, longitude });
    pathWaypoints.set([...waypoints]);

    const markerEntity = viewer.entities.add({
      position: cartesian,
      point: {
        pixelSize: 10,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: String(waypoints.length),
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    waypointEntities.push(markerEntity);
    updatePolyline();
  }

  function updatePolyline() {
    if (lineEntity) {
      viewer.entities.remove(lineEntity);
      lineEntity = null;
    }

    if (waypoints.length < 2) return;

    const positions = waypoints.flatMap(wp => [wp.longitude, wp.latitude]);

    lineEntity = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(positions),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.CYAN,
        }),
        clampToGround: true,
      },
    });
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
    for (const entity of waypointEntities) {
      viewer.entities.remove(entity);
    }
    waypointEntities = [];
    if (lineEntity) {
      viewer.entities.remove(lineEntity);
      lineEntity = null;
    }
  }

  function cancelDrawing() {
    enableCamera();
    waypoints = [];
    pathWaypoints.set([]);
    removeVisuals();
    isPathDrawingMode.set(false);
  }

  function cleanup() {
    waypoints = [];
    waypointEntities = [];
    lineEntity = null;
  }

  return { handleClick, disableCamera, enableCamera, removeVisuals, cancelDrawing, cleanup };
}
