import * as Cesium from 'cesium';

/**
 * Route preview.
 *
 * Draws a temporary start marker, end marker, and connecting dashed line
 * between two coordinates. Fully independent: owns its own Coordinates
 * shape and its own color palette, imports nothing from any other module
 * in this folder.
 */

/** Plain lat/lon pair, local to route.ts. */
export interface Coordinates {
  longitude: number;
  latitude: number;
}

/** Colors for the route preview's start marker, end marker, and connecting line. */
const ROUTE_COLORS = {
  pickup: Cesium.Color.CYAN,
  dropoff: Cesium.Color.ORANGE,
  line: Cesium.Color.CYAN
};

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
      color: ROUTE_COLORS.pickup,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  const endEntity = viewer.entities.add({
    position: endPosition,
    point: {
      pixelSize: 10,
      color: ROUTE_COLORS.dropoff,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  const lineEntity = viewer.entities.add({
    polyline: {
      positions: [startPosition, endPosition],
      width: 3,
      material: new Cesium.PolylineDashMaterialProperty({ color: ROUTE_COLORS.line }),
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