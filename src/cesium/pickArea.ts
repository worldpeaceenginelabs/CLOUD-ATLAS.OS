import * as Cesium from 'cesium';

/**
 * Rectangle / bounding-box selection.
 *
 * Click-drag-release on the globe to draw a rectangle.
 * The selected rectangle remains visible until clear() is called.
 */

/**
 * Above this camera height (meters above the ellipsoid), a click is too
 * imprecise to trust as a real pick — a single pixel can cover a large
 * ground area from far out, so the same tap that's precise up close
 * becomes essentially random guesswork zoomed out. Rather than silently
 * accept an imprecise drag, it's rejected before it starts and the
 * caller is told via onZoomRequired.
 */
const MAX_PICK_HEIGHT_METERS = 5000;

/**
 * Pick the globe position under the given screen-space coordinate, as a
 * Cartographic (radians) — this file only ever needs longitude/latitude
 * for rectangle math, never height, so there's no reason to round-trip
 * through degrees the way pickLocation.ts's version does for its own
 * (different) callers.
 */
function pickCartographic(
  viewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2
): Cesium.Cartographic | null {
  const scene = viewer.scene;

  const cartesian = scene.pickPositionSupported
    ? scene.pickPosition(windowPosition)
    : scene.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);

  if (!Cesium.defined(cartesian)) {
    return null;
  }

  return Cesium.Cartographic.fromCartesian(cartesian);
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface AreaPicker {
  /** Start listening for drag gestures on the globe. No-op if already enabled. */
  enable(): void;
  /** Stop listening and release the handler. The selected rectangle remains visible. */
  disable(): void;
  /** Remove the selected rectangle from the globe. */
  clear(): void;
}

function toBoundingBox(a: Cesium.Cartographic, b: Cesium.Cartographic): BoundingBox {
  return {
    west: Cesium.Math.toDegrees(Math.min(a.longitude, b.longitude)),
    south: Cesium.Math.toDegrees(Math.min(a.latitude, b.latitude)),
    east: Cesium.Math.toDegrees(Math.max(a.longitude, b.longitude)),
    north: Cesium.Math.toDegrees(Math.max(a.latitude, b.latitude))
  };
}

function rectangleFromCartos(
  a: Cesium.Cartographic,
  b: Cesium.Cartographic
): Cesium.Rectangle {
  return Cesium.Rectangle.fromCartographicArray([a, b]);
}

export function createAreaPicker(
  viewer: Cesium.Viewer,
  onSelect: (box: BoundingBox) => void,
  onChange?: (box: BoundingBox) => void,
  onZoomRequired?: () => void
): AreaPicker {
  let handler: Cesium.ScreenSpaceEventHandler | undefined;
  let startCarto: Cesium.Cartographic | null = null;
  let rectangleEntity: Cesium.Entity | null = null;
  let currentRectangle: Cesium.Rectangle | null = null;

  function clear(): void {
    if (rectangleEntity) {
      viewer.entities.remove(rectangleEntity);
      rectangleEntity = null;
    }

    currentRectangle = null;
  }

  return {
    enable(): void {
      if (handler) return;

      clear();

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction(
        (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          if (viewer.camera.positionCartographic.height > MAX_PICK_HEIGHT_METERS) {
            onZoomRequired?.();
            return;
          }

          const carto = pickCartographic(viewer, event.position);
          if (!carto) return;

          startCarto = carto;

          currentRectangle = rectangleFromCartos(startCarto, startCarto);

          viewer.scene.screenSpaceCameraController.enableInputs = false;

          rectangleEntity = viewer.entities.add({
            rectangle: {
              coordinates: new Cesium.CallbackProperty(
                () => currentRectangle,
                false
              ),
              height: 0,
              material: Cesium.Color.CYAN.withAlpha(0.3),
              outline: true,
              outlineColor: Cesium.Color.CYAN
            }
          });
        },
        Cesium.ScreenSpaceEventType.LEFT_DOWN
      );

      handler.setInputAction(
        (event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
          if (!startCarto) return;

          const currentCarto = pickCartographic(viewer, event.endPosition);
          if (!currentCarto) return;

          currentRectangle = rectangleFromCartos(startCarto, currentCarto);

          const box = toBoundingBox(startCarto, currentCarto);
          onChange?.(box);
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      handler.setInputAction(
        (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          if (!startCarto) return;

          const endCarto = pickCartographic(viewer, event.position);

          viewer.scene.screenSpaceCameraController.enableInputs = true;

          if (endCarto) {
            currentRectangle = rectangleFromCartos(startCarto, endCarto);

            onSelect(toBoundingBox(startCarto, endCarto));
          }

          startCarto = null;
        },
        Cesium.ScreenSpaceEventType.LEFT_UP
      );
    },

    disable(): void {
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      startCarto = null;
      handler?.destroy();
      handler = undefined;
    },

    clear
  };
}
