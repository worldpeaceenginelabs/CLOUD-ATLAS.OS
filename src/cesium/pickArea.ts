import * as Cesium from 'cesium';
import { pickLocationAt } from './pickLocation';

/**
 * Rectangle / bounding-box selection.
 *
 * Click-drag-release on the globe to draw a rectangle. A temporary entity
 * is shown while dragging for visual feedback (the only "marker" this
 * module draws, and it only exists between enable() and the next
 * disable()/completed drag).
 *
 * Same enable/disable controller shape as pickEntity.ts and
 * pickLocation.ts — the caller never sees a "mode".
 */

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface AreaPicker {
  /** Start listening for drag gestures on the globe. No-op if already enabled. */
  enable(): void;
  /** Stop listening, remove any in-progress preview, and release the handler. No-op if already disabled. */
  disable(): void;
}

function toBoundingBox(a: Cesium.Cartographic, b: Cesium.Cartographic): BoundingBox {
  return {
    west: Cesium.Math.toDegrees(Math.min(a.longitude, b.longitude)),
    south: Cesium.Math.toDegrees(Math.min(a.latitude, b.latitude)),
    east: Cesium.Math.toDegrees(Math.max(a.longitude, b.longitude)),
    north: Cesium.Math.toDegrees(Math.max(a.latitude, b.latitude))
  };
}

/**
 * Build a click-drag-release controller for rectangle selection.
 * onSelect fires once with the final bounding box when a drag completes.
 * onChange (optional) fires continuously while dragging, useful for live previews.
 * Nothing happens until enable() is called.
 */
export function createAreaPicker(
  viewer: Cesium.Viewer,
  onSelect: (box: BoundingBox) => void,
  onChange?: (box: BoundingBox) => void
): AreaPicker {
  let handler: Cesium.ScreenSpaceEventHandler | undefined;
  let startCarto: Cesium.Cartographic | null = null;
  let rectangleEntity: Cesium.Entity | null = null;

  const rectangleFromCartos = (a: Cesium.Cartographic, b: Cesium.Cartographic) =>
    Cesium.Rectangle.fromCartographicArray([a, b]);

  function removePreview(): void {
    if (rectangleEntity) {
      viewer.entities.remove(rectangleEntity);
      rectangleEntity = null;
    }
  }

  return {
    enable(): void {
      if (handler) return;
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const location = pickLocationAt(viewer, event.position);
        if (!location) return;

        startCarto = Cesium.Cartographic.fromDegrees(location.longitude, location.latitude);
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        rectangleEntity = viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(
              () => rectangleFromCartos(startCarto!, startCarto!),
              false
            ),
            material: Cesium.Color.CYAN.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.CYAN
          }
        });
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!startCarto) return;

        const location = pickLocationAt(viewer, event.endPosition);
        if (!location) return;

        const currentCarto = Cesium.Cartographic.fromDegrees(location.longitude, location.latitude);
        const box = toBoundingBox(startCarto, currentCarto);
        onChange?.(box);

        if (rectangleEntity) {
          (rectangleEntity.rectangle as Cesium.RectangleGraphics).coordinates =
            new Cesium.CallbackProperty(() => rectangleFromCartos(startCarto!, currentCarto), false);
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!startCarto) return;

        const location = pickLocationAt(viewer, event.position);
        viewer.scene.screenSpaceCameraController.enableInputs = true;

        if (location) {
          const endCarto = Cesium.Cartographic.fromDegrees(location.longitude, location.latitude);
          onSelect(toBoundingBox(startCarto, endCarto));
        }

        startCarto = null;
        removePreview();
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
    },
    disable(): void {
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      startCarto = null;
      removePreview();
      handler?.destroy();
      handler = undefined;
    }
  };
}
