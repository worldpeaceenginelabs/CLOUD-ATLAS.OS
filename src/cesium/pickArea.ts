import * as Cesium from 'cesium';
import { pickLocationAt } from './pickLocation';

/**
 * Rectangle / bounding-box selection.
 *
 * Click-drag-release on the globe to draw a rectangle.
 * The selected rectangle remains visible until clear() is called.
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
  onChange?: (box: BoundingBox) => void
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
          const location = pickLocationAt(viewer, event.position);
          if (!location) return;

          startCarto = Cesium.Cartographic.fromDegrees(
            location.longitude,
            location.latitude
          );

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

          const location = pickLocationAt(viewer, event.endPosition);
          if (!location) return;

          const currentCarto = Cesium.Cartographic.fromDegrees(
            location.longitude,
            location.latitude
          );

          currentRectangle = rectangleFromCartos(startCarto, currentCarto);

          const box = toBoundingBox(startCarto, currentCarto);
          onChange?.(box);
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      handler.setInputAction(
        (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          if (!startCarto) return;

          const location = pickLocationAt(viewer, event.position);

          viewer.scene.screenSpaceCameraController.enableInputs = true;

          if (location) {
            const endCarto = Cesium.Cartographic.fromDegrees(
              location.longitude,
              location.latitude
            );

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
