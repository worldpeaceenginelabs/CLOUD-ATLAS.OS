import { getActiveViewer } from './viewer';
import { flyTo, setView, zoomIn, zoomOut, getCameraState, flyToRectangle } from './camera';
import type { FlyToTarget, CameraState } from './camera';
import { getCurrentLocation, isGeolocationSupported } from './location';
import { createLocationPicker } from './pickLocation';
import type { LocationPicker, PickedLocation } from './pickLocation';
import { createEntityPicker } from './pickEntity';
import type { EntityPicker, PickedEntity } from './pickEntity';
import { createAreaPicker } from './pickArea';
import type { AreaPicker, BoundingBox } from './pickArea';
import { previewRoute } from './route';
import type { RouteHandle } from './route';
import { addEntity, removeEntity } from './entity';
import type { EntityOptions } from './entity';

/**
 * cesium/api.ts
 * -----------------------------------------------------------------------
 * The ONLY public interface between Svelte components and the Cesium
 * engine. Structured by capability (camera / location / pick / route /
 * entity), no UI logic, no knowledge of any component, and no direct
 * Cesium implementation knowledge either: every function below is a thin
 * pass-through to one of the internal modules.
 *
 * Internal modules (viewer.ts, camera.ts, location.ts, pickLocation.ts,
 * pickEntity.ts, pickArea.ts, route.ts, entity.ts) own all Cesium-specific
 * logic and stay implementation details — components import only from
 * here:
 *
 *   Location.svelte -> cesium/api.ts -> internal Cesium modules
 *
 * No context, no promises-as-plumbing, no provider functions, no
 * registry. Every function below simply asks viewer.ts for the current
 * viewer (getActiveViewer()) at call time. viewer.ts already owns the
 * viewer's lifecycle (createViewer()/destroyViewer()); tracking which
 * viewer is currently active is that same responsibility, not new
 * infrastructure. Cesium.svelte and App.svelte are untouched by this.
 *
 * Coordinate/box/entity shapes below (the object literals in the
 * function signatures) are written out inline rather than as named,
 * exported types. Nothing here forces components to share a nominal
 * type: a callback parameter's shape is inferred from context, and a
 * component that needs to hold one of these shapes in local state
 * declares its own local type for it. See Location.svelte's local
 * `LocalCoords` for that pattern.
 * -----------------------------------------------------------------------
 */

function requireViewer(): NonNullable<ReturnType<typeof getActiveViewer>> {
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
  /** One-shot request for the device's current position, as a plain { longitude, latitude } pair. */
  async getCurrentPosition(): Promise<{ longitude: number; latitude: number }> {
    const position = await getCurrentLocation();
    return { longitude: position.longitude, latitude: position.latitude };
  }
};

/* -------------------------------------------------------------------------- */
/* Picking (globe position / entity / area)                                   */
/* -------------------------------------------------------------------------- */

function toCoordinates(picked: PickedLocation): { longitude: number; latitude: number } {
  return { longitude: picked.longitude, latitude: picked.latitude };
}

// Holds the currently enabled picker per pick kind so disable() can find it
// again — the same shape of local state pickLocation.ts/pickEntity.ts/
// pickArea.ts already keep for their own controllers, not a cross-component
// registry.
let activeLocationPicker: LocationPicker | undefined;
let activeEntityPicker: EntityPicker | undefined;
let activeAreaPicker: AreaPicker | undefined;

export const pick = {
  /** Start listening for clicks on the globe. Fires onPick with the picked coordinates, or null on a miss. onZoomRequired fires instead of onPick when the camera is too high above the ellipsoid for a click to be trusted as precise. */
  enable(
    onPick: (coords: { longitude: number; latitude: number } | null) => void,
    onZoomRequired?: () => void
  ): void {
    activeLocationPicker?.disable();
    activeLocationPicker?.clear();

    activeLocationPicker = createLocationPicker(
      requireViewer(),
      (picked) => onPick(picked ? toCoordinates(picked) : null),
      onZoomRequired
    );

    activeLocationPicker.enable();
  },

  /** Stop listening. The selected point remains visible. */
  disable(): void {
    activeLocationPicker?.disable();
  },

  /** Remove the selected point from the globe. */
  clear(): void {
    activeLocationPicker?.clear();
  },

  entity: {
    /** Start listening for clicks on the globe. Fires onPick with the picked entity, or null on a miss. */
    enable(onPick: (entity: PickedEntity) => void): void {
      activeEntityPicker?.disable();
      activeEntityPicker = createEntityPicker(requireViewer(), onPick);
      activeEntityPicker.enable();
    },

    /** Stop listening. No-op if not enabled. */
    disable(): void {
      activeEntityPicker?.disable();
      activeEntityPicker = undefined;
    }
  },

  area: {
    /** Start listening for click-drag-release rectangle selection. onSelect fires once per completed drag; onChange fires continuously while dragging. onZoomRequired fires instead of starting a drag when the camera is too high above the ellipsoid for a pick to be trusted as precise. */
    enable(
      onSelect: (box: BoundingBox) => void,
      onChange?: (box: BoundingBox) => void,
      onZoomRequired?: () => void
    ): void {
      activeAreaPicker?.disable();
      activeAreaPicker?.clear();

      activeAreaPicker = createAreaPicker(requireViewer(), onSelect, onChange, onZoomRequired);
      activeAreaPicker.enable();
    },

    /** Stop listening. The selected rectangle remains visible. */
    disable(): void {
      activeAreaPicker?.disable();
    },

    /** Remove the selected rectangle from the globe. */
    clear(): void {
      activeAreaPicker?.clear();
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Route preview                                                              */
/* -------------------------------------------------------------------------- */

/** Public name for the handle returned by route.preview(); same shape as route.ts's own RouteHandle. */
export type RoutePreview = RouteHandle;

export const route = {
  /** Draw a temporary start marker, end marker, and connecting line between two coordinates. */
  preview(
    from: { longitude: number; latitude: number },
    to: { longitude: number; latitude: number }
  ): RoutePreview {
    return previewRoute(requireViewer(), from, to);
  }
};

/* -------------------------------------------------------------------------- */
/* Entity (generic add/remove)                                                */
/* -------------------------------------------------------------------------- */

export type { EntityOptions };

export const entity = {
  /**
   * Add an arbitrary Cesium entity under `id`. Has no opinion on
   * appearance — pass whatever Cesium entity options (point, billboard,
   * polyline, polygon, label, ...) the component needs. `id` must be
   * unique; reusing an id that's still on the globe throws.
   */
  add(id: string, options: EntityOptions): void {
    addEntity(requireViewer(), id, options);
  },

  /** Remove the entity previously added under `id`. No-op if it's already gone or was never added. */
  remove(id: string): void {
    removeEntity(requireViewer(), id);
  }
};

/* -------------------------------------------------------------------------- */
/* Convenience aggregate                                                      */
/* -------------------------------------------------------------------------- */

/** Same capabilities, grouped for call sites that prefer `globe.camera...`, `globe.pick...` etc. */
export const globe = { camera, location, pick, route, entity };
