import * as Cesium from 'cesium';

/**
 * Entity picking helpers.
 *
 * pickEntityAt: a one-shot pick at a given screen position.
 * createEntityPicker: builds an enable/disable-able click-to-pick
 * controller. The controller owns its ScreenSpaceEventHandler entirely —
 * the caller only ever calls enable()/disable(), it never sees a
 * "pick mode" concept.
 */

export type PickedEntity = Cesium.Entity | null;

/** Pick whatever entity (if any) sits at the given screen-space position. */
export function pickEntityAt(
  viewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2
): PickedEntity {
  const picked = viewer.scene.pick(windowPosition);
  if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
    return picked.id;
  }
  return null;
}

export interface EntityPicker {
  /** Start listening for left-clicks on the globe. No-op if already enabled. */
  enable(): void;
  /** Stop listening and release the underlying event handler. No-op if already disabled. */
  disable(): void;
}

/**
 * Build a click-to-pick controller for entities. Reports the picked
 * entity (or null when the click missed every entity) via onPick.
 * Nothing happens until enable() is called.
 */
export function createEntityPicker(
  viewer: Cesium.Viewer,
  onPick: (entity: PickedEntity) => void
): EntityPicker {
  let handler: Cesium.ScreenSpaceEventHandler | undefined;

  return {
    enable(): void {
      if (handler) return;
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        onPick(pickEntityAt(viewer, click.position));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    },
    disable(): void {
      handler?.destroy();
      handler = undefined;
    }
  };
}
