import * as Cesium from 'cesium';
import { getActiveViewer } from './viewer';
import { flyTo, setView, zoomIn, zoomOut, getCameraState, flyToRectangle } from './camera';
import type { FlyToTarget, CameraState } from './camera';
import { getCurrentLocation, isGeolocationSupported } from './location';
import { createLocationPicker } from './pickLocation';
import type { LocationPicker, PickedLocation } from './pickLocation';

/**
 * cesium/api.ts
 * -----------------------------------------------------------------------
 * The ONLY public interface between Svelte components and the Cesium
 * engine. Structured by capability (camera / location / pick / route),
 * no UI logic, no knowledge of any component.
 *
 * Internal modules (viewer.ts, camera.ts, pickLocation.ts, pickEntity.ts,
 * pickArea.ts, location.ts) stay implementation details — components
 * import only from here:
 *
 *   Location.svelte -> cesium/api.ts -> internal Cesium modules
 *
 * No context, no promises-as-plumbing, no provider functions, no
 * registry. Every function below simply asks viewer.ts for the current
 * viewer (getActiveViewer()) at call time. viewer.ts already owns the
 * viewer's lifecycle (createViewer()/destroyViewer()); tracking which
 * viewer is currently active is that same responsibility, not new
 * infrastructure. Cesium.svelte and App.svelte are untouched by this.
 * -----------------------------------------------------------------------
 */

/** Plain lat/lon pair. The only coordinate shape components ever see. */
export interface Coordinates {
  longitude: number;
  latitude: number;
}

function requireViewer(): Cesium.Viewer {
  const viewer = getActiveViewer();
  if (!viewer) {
    throw new Error(
      'No active Cesium viewer. Cesium.svelte must be mounted (createViewer() called) before using cesium/api.ts.'
    );
  }
  return viewer;
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                      */
/* -------------------------------------------------------------------------- */

export const camera = {
  flyTo(target: FlyToTarget, options?: { duration?: number }): Promise<void> {
    return flyTo(requireViewer(), target, options);
  },
  setView(target: FlyToTarget): void {
    setView(requireViewer(), target);
  },
  zoomIn(amount?: number): void {
    zoomIn(requireViewer(), amount);
  },
  zoomOut(amount?: number): void {
    zoomOut(requireViewer(), amount);
  },
  getState(): CameraState {
    return getCameraState(requireViewer());
  },
  flyToRectangle(
    rectangle: { west: number; south: number; east: number; north: number },
    options?: { duration?: number }
  ): Promise<void> {
    return flyToRectangle(requireViewer(), rectangle, options);
  }
};

/* -------------------------------------------------------------------------- */
/* Location (device GPS)                                                      */
/* -------------------------------------------------------------------------- */

export const location = {
  /** Whether the browser supports geolocation at all. Doesn't need a viewer. */
  isSupported: isGeolocationSupported,
  /** One-shot request for the device's current position, as plain Coordinates. */
  async getCurrentPosition(): Promise<Coordinates> {
    const position = await getCurrentLocation();
    return { longitude: position.longitude, latitude: position.latitude };
  }
};

/* -------------------------------------------------------------------------- */
/* Picking (globe position)                                                   */
/* -------------------------------------------------------------------------- */

function toCoordinates(picked: PickedLocation): Coordinates {
  return { longitude: picked.longitude, latitude: picked.latitude };
}

// Holds the currently enabled picker so disable() can find it again — the
// same shape of local state pickLocation.ts/pickEntity.ts/pickArea.ts
// already keep for their own controllers, not a cross-component registry.
let activePicker: LocationPicker | undefined;

export const pick = {
  /** Start listening for clicks on the globe. Fires onPick with the picked coordinates, or null on a miss. */
  enable(onPick: (coords: Coordinates | null) => void): void {
    activePicker?.disable();
    activePicker = createLocationPicker(requireViewer(), (picked) =>
      onPick(picked ? toCoordinates(picked) : null)
    );
    activePicker.enable();
  },
  /** Stop listening. No-op if not enabled. */
  disable(): void {
    activePicker?.disable();
    activePicker = undefined;
  }
};

/* -------------------------------------------------------------------------- */
/* Route preview                                                              */
/* -------------------------------------------------------------------------- */

export interface RoutePreview {
  /** Remove the preview (start marker, end marker, connecting line) from the globe. */
  remove(): void;
}

export const route = {
  /** Draw a temporary start marker, end marker, and connecting line between two coordinates. */
  preview(from: Coordinates, to: Coordinates): RoutePreview {
    const viewer = requireViewer();

    const startPosition = Cesium.Cartesian3.fromDegrees(from.longitude, from.latitude);
    const endPosition = Cesium.Cartesian3.fromDegrees(to.longitude, to.latitude);

    const startEntity = viewer.entities.add({
      position: startPosition,
      point: {
        pixelSize: 10,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });

    const endEntity = viewer.entities.add({
      position: endPosition,
      point: {
        pixelSize: 10,
        color: Cesium.Color.ORANGE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });

    const lineEntity = viewer.entities.add({
      polyline: {
        positions: [startPosition, endPosition],
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN }),
        clampToGround: true
      }
    });

    return {
      remove(): void {
        viewer.entities.remove(startEntity);
        viewer.entities.remove(endEntity);
        viewer.entities.remove(lineEntity);
      }
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Convenience aggregate                                                      */
/* -------------------------------------------------------------------------- */

/** Same four capabilities, grouped for call sites that prefer `globe.camera...`, `globe.pick...` etc. */
export const globe = { camera, location, pick, route };