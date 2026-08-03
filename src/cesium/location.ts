/**
 * Thin wrapper around the browser Geolocation API.
 *
 * No Cesium dependency here on purpose: "where is the user" is a browser
 * concern, not a globe concern. Cesium.svelte is what connects the two
 * (e.g. by flying the camera to the returned coordinates).
 */

export interface GeoPosition {
  longitude: number;
  latitude: number;
  /** Meters, if the device provides it. */
  altitude: number | null;
  /** Accuracy of the position, in meters. */
  accuracy: number;
  timestamp: number;
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

function toGeoPosition(position: GeolocationPosition): GeoPosition {
  return {
    longitude: position.coords.longitude,
    latitude: position.coords.latitude,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp
  };
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Check current permission state without triggering a browser prompt, where supported. */
export async function checkPermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
    return 'unsupported';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName
    });
    return status.state as PermissionState;
  } catch {
    return 'unsupported';
  }
}

/** One-shot request for the device's current position. */
export function getCurrentLocation(
  options: PositionOptions = { enableHighAccuracy: true }
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported in this environment.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toGeoPosition(position)),
      (error) => reject(error),
      options
    );
  });
}

/**
 * Subscribe to ongoing position updates.
 * Returns the watch id so the caller can pass it to clearWatch().
 */
export function watchLocation(
  onUpdate: (position: GeoPosition) => void,
  onError?: (error: GeolocationPositionError) => void,
  options: PositionOptions = { enableHighAccuracy: true }
): number {
  if (!isGeolocationSupported()) {
    throw new Error('Geolocation is not supported in this environment.');
  }
  return navigator.geolocation.watchPosition(
    (position) => onUpdate(toGeoPosition(position)),
    onError,
    options
  );
}

export function clearWatch(watchId: number): void {
  if (isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId);
  }
}
