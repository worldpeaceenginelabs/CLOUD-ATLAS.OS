import * as Cesium from 'cesium';

/**
 * Marker placement.
 *
 * Owns marker rendering (a colored point entity) and the marker color
 * palette. MARKER_COLORS is exported so route.ts can reuse the exact same
 * colors for its start/end markers instead of maintaining its own copy.
 */

/** Plain lat/lon pair. The coordinate shape shared across marker.ts, route.ts and api.ts. */
export interface Coordinates {
  longitude: number;
  latitude: number;
}

/** Named marker looks, kept in one place so every caller stays visually consistent. */
export type MarkerKind = 'pickup' | 'dropoff' | 'point';

export const MARKER_COLORS: Record<MarkerKind, Cesium.Color> = {
  pickup: Cesium.Color.CYAN,
  dropoff: Cesium.Color.ORANGE,
  point: Cesium.Color.CYAN
};

export interface MarkerHandle {
  /** Remove this marker from the globe. */
  remove(): void;
}

/** Place a single pin at the given coordinates. Caller owns the returned handle and must call remove() themselves. */
export function placeMarker(
  viewer: Cesium.Viewer,
  coords: Coordinates,
  kind: MarkerKind = 'point'
): MarkerHandle {
  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude),
    point: {
      pixelSize: 10,
      color: MARKER_COLORS[kind],
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });

  return {
    remove(): void {
      viewer.entities.remove(entity);
    }
  };
}