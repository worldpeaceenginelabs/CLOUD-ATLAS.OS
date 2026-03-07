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

const DEG_THRESHOLD = 0.00015; // ~15 m in degrees
const MIN_INTERVAL_MS = 10_000; // 10 sec

export function initUserLocation(
  viewer: Cesium.Viewer,
  userLiveLocation: Writable<{ latitude: number; longitude: number } | null>,
): UserLocationHandle {
  let geoWatchId: number | null = null;
  let lastLat: number | null = null;
  let lastLon: number | null = null;
  let lastUpdateTime = 0;

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
      },
    });

    const center = new Entity({
      id: pointId,
      position,
      point: {
        pixelSize: 4,
        color: Cesium.Color.WHITE.withAlpha(0.85),
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
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const now = Date.now();

        if (lastLat === null || lastLon === null) {
          userLiveLocation.set({ latitude: lat, longitude: lon });
          lastLat = lat;
          lastLon = lon;
          lastUpdateTime = now;
          return;
        }

        const overThreshold =
          Math.abs(lat - lastLat) >= DEG_THRESHOLD || Math.abs(lon - lastLon) >= DEG_THRESHOLD;
        const overInterval = now - lastUpdateTime >= MIN_INTERVAL_MS;
        if (overThreshold && overInterval) {
          userLiveLocation.set({ latitude: lat, longitude: lon });
          lastLat = lat;
          lastLon = lon;
          lastUpdateTime = now;
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const msg = isIOS
            ? 'Location access was denied. Please enable it in Settings → Privacy & Security → Location Services → Safari.'
            : 'Location access was denied. Please allow location access in your browser settings.';
          alert(msg);
        }
      },
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
