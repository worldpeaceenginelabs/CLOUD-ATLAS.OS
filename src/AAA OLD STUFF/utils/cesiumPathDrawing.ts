/**
 * Path Drawing Handler
 *
 * Click to add waypoints, drag existing waypoints to reposition,
 * right-click a waypoint to remove it.
 */

import * as Cesium from 'cesium';
import type { Viewer, Entity, ScreenSpaceEventHandler } from 'cesium';
import type { Writable } from 'svelte/store';
import type { LatLon } from '../types';
import { pickPositionToLonLat, setCameraControlsEnabled } from './cesiumHelpers';

export interface PathDrawingHandle {
  handleClick(click: any): void;
  disableCamera(): void;
  enableCamera(): void;
  removeVisuals(): void;
  cancelDrawing(): void;
  cleanup(): void;
}

const WP_ID_PREFIX = '_pathWp_';

export function initPathDrawing(
  viewer: Viewer,
  pathWaypoints: Writable<LatLon[]>,
  isPathDrawingMode: Writable<boolean>,
): PathDrawingHandle {
  let waypointEntities: Entity[] = [];
  let lineEntity: Entity | null = null;
  let waypoints: LatLon[] = [];

  let dragHandler: ScreenSpaceEventHandler | null = null;
  let dragIndex = -1;
  let isDragging = false;

  function syncStore() {
    pathWaypoints.set([...waypoints]);
  }

  function waypointEntityId(index: number): string {
    return `${WP_ID_PREFIX}${index}`;
  }

  function findWaypointIndex(entityId: string): number {
    if (!entityId?.startsWith(WP_ID_PREFIX)) return -1;
    return parseInt(entityId.substring(WP_ID_PREFIX.length), 10);
  }

  function createMarker(index: number): Entity {
    const wp = waypoints[index];
    return viewer.entities.add({
      id: waypointEntityId(index),
      position: Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude),
      point: {
        pixelSize: 12,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: String(index + 1),
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -16),
      },
    });
  }

  function rebuildMarkers() {
    for (const e of waypointEntities) viewer.entities.remove(e);
    waypointEntities = [];
    for (let i = 0; i < waypoints.length; i++) {
      waypointEntities.push(createMarker(i));
    }
    updatePolyline();
  }

  function handleClick(click: any) {
    if (isDragging) return;

    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?.id?.startsWith(WP_ID_PREFIX)) return;

    const coords = pickPositionToLonLat(viewer, click.position);
    if (!coords) return;

    waypoints.push({ latitude: coords.latitude, longitude: coords.longitude });
    waypointEntities.push(createMarker(waypoints.length - 1));
    updatePolyline();
    syncStore();
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

  function initDragHandlers() {
    if (dragHandler) return;
    dragHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    dragHandler.setInputAction((e: any) => {
      const picked = viewer.scene.pick(e.position);
      if (!Cesium.defined(picked) || !picked.id?.id?.startsWith(WP_ID_PREFIX)) return;
      dragIndex = findWaypointIndex(picked.id.id);
      if (dragIndex < 0) return;
      isDragging = true;
      disableCamera();
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    dragHandler.setInputAction((e: any) => {
      if (!isDragging || dragIndex < 0) return;
      const coords = pickPositionToLonLat(viewer, e.endPosition);
      if (!coords) return;

      waypoints[dragIndex] = { latitude: coords.latitude, longitude: coords.longitude };
      const entity = waypointEntities[dragIndex];
      if (entity) {
        (entity as any).position = Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude);
      }
      updatePolyline();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    dragHandler.setInputAction(() => {
      if (isDragging) {
        isDragging = false;
        syncStore();
      }
      dragIndex = -1;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    dragHandler.setInputAction((e: any) => {
      const picked = viewer.scene.pick(e.position);
      if (!Cesium.defined(picked) || !picked.id?.id?.startsWith(WP_ID_PREFIX)) return;
      const idx = findWaypointIndex(picked.id.id);
      if (idx < 0) return;

      waypoints.splice(idx, 1);
      rebuildMarkers();
      syncStore();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  function destroyDragHandlers() {
    if (dragHandler) {
      dragHandler.destroy();
      dragHandler = null;
    }
    isDragging = false;
    dragIndex = -1;
  }

  function disableCamera() {
    setCameraControlsEnabled(viewer, false);
    initDragHandlers();
  }

  function enableCamera() {
    setCameraControlsEnabled(viewer, true);
    destroyDragHandlers();
  }

  function removeVisuals() {
    for (const entity of waypointEntities) viewer.entities.remove(entity);
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
    destroyDragHandlers();
    waypoints = [];
    waypointEntities = [];
    lineEntity = null;
  }

  return { handleClick, disableCamera, enableCamera, removeVisuals, cancelDrawing, cleanup };
}
