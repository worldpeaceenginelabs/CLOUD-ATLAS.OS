import * as Cesium from 'cesium';
import { Entity, Cartesian3 } from 'cesium';
import type { Writable } from 'svelte/store';
import { clampToSurface } from './clampToSurface';
import { createPulseRingEntities, flyToLonLat, isValidLonLat } from './cesiumHelpers';

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
    return createPulseRingEntities({
      idBase: pointId,
      position,
      outerColor: '#4285F4',
      innerColor: '#FF6D00',
    });
  }

  function updateRingPositions(entities: Entity[], longitude: number, latitude: number) {
    clampToSurface(longitude, latitude).then(newPos => {
      const positionProperty = new Cesium.ConstantPositionProperty(
        newPos,
        Cesium.ReferenceFrame.FIXED,
      );
      entities.forEach(e => {
        e.position = positionProperty;
      });
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
        if (!isValidLonLat(lat, lon)) return;
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
