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

/**
 * Turn a raw GeolocationPositionError into a message a user can act on.
 * Ported from a battle-tested implementation — in particular the
 * iOS-specific PERMISSION_DENIED wording, since "enable it in Settings"
 * means something different there than "check your browser settings".
 */
export function describeGeolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS
      ? 'Location access was denied. Please enable it in Settings → Privacy & Security → Location Services → Safari.'
      : 'Location access was denied. Please allow location access in your browser settings.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Your position could not be determined.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Determining your location took too long. Please try again.';
  }
  return error.message || 'Unable to determine your location.';
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

/**
 * One-shot request for the device's current position.
 *
 * Built on watchPosition() rather than getCurrentPosition(): the watch is
 * started, resolved on the first fix, then torn down right away.
 * getCurrentPosition() asks the OS location provider to spin up cold on
 * every call; watchPosition() keeps it "warm", which in practice returns
 * the first fix noticeably faster and more reliably. External callers see
 * no difference — still just `await getCurrentLocation()`.
 *
 * A TIMEOUT error from the provider ("no fix yet") is not treated as a
 * failure — it's logged and the watch just keeps running in the
 * background until a real fix or a real error (e.g. permission denied)
 * arrives. The user never sees a "took too long" message for something
 * that isn't actually broken.
 */
export function getCurrentLocation(
  options: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported in this environment.'));
      return;
    }

    let watchId: number | null = null;
    let settled = false;

    function finish(settle: () => void): void {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      settle();
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => finish(() => resolve(toGeoPosition(position))),
      (error) => {
        if (error.code === error.TIMEOUT) {
          // Not a real failure — the provider is still trying. Keep waiting.
          console.warn('Geolocation: no fix yet, still trying…', error.message);
          return;
        }
        finish(() => reject(new Error(describeGeolocationError(error))));
      },
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
  options: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
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