import * as Cesium from 'cesium';
import { MARKER_COLORS } from './marker';
import type { Coordinates } from './marker';

/**
 * Route preview.
 *
 * Draws a temporary start marker, end marker, and connecting dashed line
 * between two coordinates. Reuses MARKER_COLORS from marker.ts (pickup for
 * the start point, dropoff for the end point) so a route preview always
 * matches the colors of a standalone pickup/dropoff marker pair.
 */

export interface RouteHandle {
  /** Remove the preview (start marker, end marker, connecting line) from the globe. */
  remove(): void;
}

/** Draw a temporary start marker, end marker, and connecting line between two coordinates. */
export function previewRoute(viewer: Cesium.Viewer, from: Coordinates, to: Coordinates): RouteHandle {
  const startPosition = Cesium.Cartesian3.fromDegrees(from.longitude, from.latitude);
  const endPosition = Cesium.Cartesian3.fromDegrees(to.longitude, to.latitude);

  const startEntity = viewer.entities.add({
    position: startPosition,
    point: {
      pixelSize: 10,
      color: MARKER_COLORS.pickup,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  const endEntity = viewer.entities.add({
    position: endPosition,
    point: {
      pixelSize: 10,
      color: MARKER_COLORS.dropoff,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  const lineEntity = viewer.entities.add({
    polyline: {
      positions: [startPosition, endPosition],
      width: 3,
      material: new Cesium.PolylineDashMaterialProperty({ color: MARKER_COLORS.point }),
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