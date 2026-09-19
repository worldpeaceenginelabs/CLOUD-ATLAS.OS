import * as Cesium from 'cesium';

/**
 * Globe position picking helpers.
 *
 * pickLocationAt: a one-shot pick for a known screen position.
 * createLocationPicker: an enable/disable-able click-to-pick controller.
 * The selected point remains visible until clear() is called.
 */

/**
 * Above this camera height (meters above the ellipsoid), a click is too
 * imprecise to trust as a real pick — a single pixel can cover a large
 * ground area from far out, so the same tap that's precise up close
 * becomes essentially random guesswork zoomed out. Rather than silently
 * accept an imprecise pick, the click is rejected and the caller is told
 * via onZoomRequired instead of onPick — this is a distinct case from an
 * actual miss (clicking off the globe entirely), which still reports
 * onPick(null) as before.
 */
const MAX_PICK_HEIGHT_METERS = 5000;

export interface PickedLocation {
  longitude: number;
  latitude: number;
  /** Meters above the ellipsoid. */
  height: number;
}

/**
 * Pick the globe position under the given screen-space coordinate.
 * Uses the scene's terrain/3D-tiles depth buffer when available, falling
 * back to ellipsoid intersection. Returns null if nothing was hit.
 */
export function pickLocationAt(
  viewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2
): PickedLocation | null {
  const scene = viewer.scene;

  const cartesian = scene.pickPositionSupported
    ? scene.pickPosition(windowPosition)
    : scene.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);

  if (!Cesium.defined(cartesian)) {
    return null;
  }

  const carto = Cesium.Cartographic.fromCartesian(cartesian);

  return {
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
    height: carto.height
  };
}

export interface LocationPicker {
  /** Start listening for left-clicks on the globe. No-op if already enabled. */
  enable(): void;

  /** Stop listening and release the event handler. The selected point remains visible. */
  disable(): void;

  /** Remove the selected point from the globe. */
  clear(): void;

  /**
   * Select a location that didn't come from a click on the globe (e.g. an
   * address search result). Draws the exact same marker a click would have
   * drawn and reports it via onPick, same as a real click — callers can't
   * tell the two apart.
   */
  select(location: PickedLocation): void;
}

/**
 * Build a click-to-pick controller for globe positions.
 * Reports the picked lat/lon/height via onPick.
 * The selected point remains visible until clear() is called.
 */
export function createLocationPicker(
  viewer: Cesium.Viewer,
  onPick: (location: PickedLocation | null) => void,
  onZoomRequired?: () => void
): LocationPicker {
  let handler: Cesium.ScreenSpaceEventHandler | undefined;
  let markerEntity: Cesium.Entity | null = null;

  function clear(): void {
    if (markerEntity) {
      viewer.entities.remove(markerEntity);
      markerEntity = null;
    }
  }

  function select(location: PickedLocation): void {
    clear();

    markerEntity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        location.longitude,
        location.latitude,
        location.height
      ),
      point: {
        pixelSize: 12,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    });

    onPick(location);
  }

  return {
    enable(): void {
      if (handler) return;

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (viewer.camera.positionCartographic.height > MAX_PICK_HEIGHT_METERS) {
          onZoomRequired?.();
          return;
        }

        const location = pickLocationAt(viewer, click.position);

        if (!location) {
          onPick(null);
          return;
        }

        select(location);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    },

    disable(): void {
      handler?.destroy();
      handler = undefined;
    },

    clear,

    select
  };
}
