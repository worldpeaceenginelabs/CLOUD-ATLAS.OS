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
import { placeMarker } from './marker';
import type { Coordinates, MarkerKind, MarkerHandle, MarkerOptions } from './marker';
import { previewRoute } from './route';
import type { RouteHandle } from './route';
import { addEntity, removeEntity } from './entity';
import type { EntityOptions } from './entity';

/**
 * cesium/api.ts
 * -----------------------------------------------------------------------
 * The ONLY public interface between Svelte components and the Cesium
 * engine. Structured by capability (camera / location / pick / marker /
 * route / entity), no UI logic, no knowledge of any component, and — as of
 * this revision — no direct Cesium implementation knowledge either: every
 * function below is a thin pass-through to one of the internal modules.
 *
 * Internal modules (viewer.ts, camera.ts, location.ts, pickLocation.ts,
 * pickEntity.ts, pickArea.ts, marker.ts, route.ts, entity.ts) own all
 * Cesium-specific logic and stay implementation details — components
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
export type { Coordinates };

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
  /** One-shot request for the device's current position, as plain Coordinates. */
  async getCurrentPosition(): Promise<Coordinates> {
    const position = await getCurrentLocation();
    return { longitude: position.longitude, latitude: position.latitude };
  }
};

/* -------------------------------------------------------------------------- */
/* Picking (globe position / entity / area)                                   */
/* -------------------------------------------------------------------------- */

function toCoordinates(picked: PickedLocation): Coordinates {
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
  /** Start listening for clicks on the globe. Fires onPick with the picked coordinates, or null on a miss. */
  enable(onPick: (coords: Coordinates | null) => void): void {
    activeLocationPicker?.disable();
    activeLocationPicker = createLocationPicker(requireViewer(), (picked) =>
      onPick(picked ? toCoordinates(picked) : null)
    );
    activeLocationPicker.enable();
  },
  /** Stop listening. No-op if not enabled. */
  disable(): void {
    activeLocationPicker?.disable();
    activeLocationPicker = undefined;
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
    /** Start listening for click-drag-release rectangle selection. onSelect fires once per completed drag; onChange fires continuously while dragging. */
    enable(onSelect: (box: BoundingBox) => void, onChange?: (box: BoundingBox) => void): void {
      activeAreaPicker?.disable();
      activeAreaPicker = createAreaPicker(requireViewer(), onSelect, onChange);
      activeAreaPicker.enable();
    },
    /** Stop listening and remove any in-progress preview. No-op if not enabled. */
    disable(): void {
      activeAreaPicker?.disable();
      activeAreaPicker = undefined;
    }
  }
};

export type { PickedEntity, BoundingBox };

/* -------------------------------------------------------------------------- */
/* Marker                                                                      */
/* -------------------------------------------------------------------------- */

/** @deprecated kept as an alias for the existing public name; same shape as MarkerHandle. */
export type MarkerPreview = MarkerHandle;
export type { MarkerKind, MarkerOptions };

export const marker = {
  /**
   * Place a single pin at the given coordinates. Caller owns the returned
   * handle and must call remove() themselves.
   *
   * `options` lets the caller override individual appearance properties
   * (color, pixelSize, outlineColor, outlineWidth) for this one marker;
   * anything left unset falls back to `kind`'s default look.
   */
  place(coords: Coordinates, kind: MarkerKind = 'point', options?: MarkerOptions): MarkerPreview {
    return placeMarker(requireViewer(), coords, kind, options);
  }
};

/* -------------------------------------------------------------------------- */
/* Route preview                                                              */
/* -------------------------------------------------------------------------- */

/** @deprecated kept as an alias for the existing public name; same shape as RouteHandle. */
export type RoutePreview = RouteHandle;

export const route = {
  /** Draw a temporary start marker, end marker, and connecting line between two coordinates. */
  preview(from: Coordinates, to: Coordinates): RoutePreview {
    return previewRoute(requireViewer(), from, to);
  }
};

/* -------------------------------------------------------------------------- */
/* Entity (generic add/remove)                                                */
/* -------------------------------------------------------------------------- */

export type { EntityOptions };

export const entity = {
  /**
   * Add an arbitrary Cesium entity under `id`. Unlike marker.place(), this
   * has no opinion on appearance — pass whatever Cesium entity options
   * (point, billboard, polyline, polygon, label, ...) the component needs.
   * `id` must be unique; reusing an id that's still on the globe throws.
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
export const globe = { camera, location, pick, route, marker, entity };