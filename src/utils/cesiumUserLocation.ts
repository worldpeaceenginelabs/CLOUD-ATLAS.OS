import * as Cesium from 'cesium';
import { Entity, Cartesian3 } from 'cesium';
import type { Writable } from 'svelte/store';
import { clampToSurface } from './clampToSurface';
import { flyToLonLat } from './cesiumHelpers';

export interface UserLocationHandle {
  startTracking(): void;
  stopTracking(): void;
  createRing(pointId: string, position: Cartesian3): Entity[];
  flyToMe(location: { latitude: number; longitude: number }): void;
  updateRingPositions(entities: Entity[], longitude: number, latitude: number): void;
  cleanup(): void;
}

export function initUserLocation(
  viewer: Cesium.Viewer,
  userLiveLocation: Writable<{ latitude: number; longitude: number } | null>,
): UserLocationHandle {
  let geoWatchId: number | null = null;

  function createRing(pointId: string, position: Cartesian3): Entity[] {
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
  }

  function updateRingPositions(entities: Entity[], longitude: number, latitude: number) {
    clampToSurface(longitude, latitude).then(newPos => {
      entities.forEach(e => { (e.position as any) = newPos; });
    });
  }

  function startTracking() {
    if (!navigator.geolocation) return;
    if (geoWatchId !== null) return;

    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        userLiveLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => { console.error('Geolocation error:', error); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  function stopTracking() {
    if (geoWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
  }

  function flyToMe(location: { latitude: number; longitude: number }) {
    flyToLonLat(viewer, location.longitude, location.latitude, 2000, 1.5);
  }

  function cleanup() {
    stopTracking();
  }

  return { startTracking, stopTracking, createRing, flyToMe, updateRingPositions, cleanup };
}
