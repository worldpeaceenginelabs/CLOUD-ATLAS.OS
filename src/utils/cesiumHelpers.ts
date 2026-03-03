/**
 * Shared Cesium helper functions used across the map layer.
 * Eliminates duplication of common entity, camera, and coordinate operations.
 */

import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  HeadingPitchRoll,
  Transforms,
  Entity,
  Color,
  CustomDataSource,
} from 'cesium';
import * as Cesium from 'cesium';
import type { ModelData, Listing } from '../types';
import { clampToSurface } from './clampToSurface';

// ─── Model Helpers ──────────────────────────────────────────────

export function resolveModelUri(
  modelData: ModelData,
  createdObjectURLs: string[],
): string | null {
  if (modelData.source === 'file' && modelData.file) {
    if (modelData.file instanceof File) {
      const uri = URL.createObjectURL(modelData.file);
      createdObjectURLs.push(uri);
      return uri;
    }
    return modelData.file as string;
  }
  if (modelData.source === 'url' && modelData.url) {
    return modelData.url;
  }
  return null;
}

export function modelPositionAndOrientation(modelData: ModelData) {
  const position = Cartesian3.fromDegrees(
    modelData.coordinates.longitude,
    modelData.coordinates.latitude,
    modelData.transform.height,
  );
  const heading = CesiumMath.toRadians(modelData.transform.heading);
  const pitch = CesiumMath.toRadians(modelData.transform.pitch);
  const roll = CesiumMath.toRadians(modelData.transform.roll);
  const orientation = Transforms.headingPitchRollQuaternion(
    position,
    new HeadingPitchRoll(heading, pitch, roll),
  );
  return { position, orientation };
}

// ─── Entity Helpers ─────────────────────────────────────────────

export function removeEntityById(
  dataSource: CustomDataSource | null,
  id: string,
): boolean {
  if (!dataSource) return false;
  const entity = dataSource.entities.getById(id);
  if (entity) {
    dataSource.entities.remove(entity);
    return true;
  }
  return false;
}

export function setModelVisibility(
  dataSource: CustomDataSource | null,
  modelId: string,
  visible: boolean,
): void {
  if (!dataSource) return;
  const entity = dataSource.entities.getById(modelId);
  if (entity && entity.model) {
    (entity.model as any).show = visible;
  }
}

// ─── Camera Helpers ─────────────────────────────────────────────

export function flyToLonLat(
  viewer: any,
  lon: number,
  lat: number,
  height: number,
  duration?: number,
): void {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    ...(duration != null && { duration }),
  });
}

export function flyToEntityPosition(
  viewer: any,
  entity: Entity | null,
  height = 2000,
  duration?: number,
): void {
  if (!entity || !viewer) return;
  const pos = entity.position?.getValue(Cesium.JulianDate.now());
  if (!pos) return;
  const c = Cartographic.fromCartesian(pos);
  flyToLonLat(
    viewer,
    CesiumMath.toDegrees(c.longitude),
    CesiumMath.toDegrees(c.latitude),
    height,
    duration,
  );
}

// ─── Coordinate Helpers ─────────────────────────────────────────

export function pickPositionToLonLat(
  viewer: any,
  screenPosition: any,
): { longitude: number; latitude: number; height: number; cartesian: any } | null {
  const cartesian = viewer.scene.pickPosition(screenPosition);
  if (!cartesian) return null;
  const cartographic = Cartographic.fromCartesian(cartesian);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    height: cartographic.height,
    cartesian,
  };
}

// ─── Picked Point Marker ────────────────────────────────────────

const PICKED_POINT_GREEN = '#34A853';

export function addPickedPointMarker(
  viewer: any,
  position: any,
  existingEntities: Entity[],
): Entity[] {
  if (!viewer) return [];
  removeMarkers(viewer, existingEntities);

  const t0 = Date.now();

  const outerPulse = new Cesium.CallbackProperty(() => {
    const t = (Date.now() - t0) / 1000;
    return 22 + 4 * Math.sin((2 * Math.PI * t) / 4);
  }, false);

  const innerPulse = new Cesium.CallbackProperty(() => {
    const t = (Date.now() - t0) / 1000 - 0.7;
    return 13 + 3 * Math.sin((2 * Math.PI * t) / 4);
  }, false);

  const outer = new Entity({
    id: 'pickedPoint_outer',
    position,
    point: {
      pixelSize: outerPulse,
      color: Color.fromCssColorString(PICKED_POINT_GREEN).withAlpha(0.04),
      outlineColor: Color.fromCssColorString(PICKED_POINT_GREEN).withAlpha(0.7),
      outlineWidth: 2,
    },
  });

  const inner = new Entity({
    id: 'pickedPoint_inner',
    position,
    point: {
      pixelSize: innerPulse,
      color: Color.fromCssColorString(PICKED_POINT_GREEN).withAlpha(0.04),
      outlineColor: Color.fromCssColorString(PICKED_POINT_GREEN).withAlpha(0.7),
      outlineWidth: 2,
    },
  });

  const center = new Entity({
    id: 'pickedPoint',
    position,
    point: {
      pixelSize: 4,
      color: Cesium.Color.WHITE.withAlpha(0.85),
    },
  });

  const hitCanvas = document.createElement('canvas');
  hitCanvas.width = 1;
  hitCanvas.height = 1;
  const ctx = hitCanvas.getContext('2d');
  if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1); }

  const hitArea = new Entity({
    id: 'pickedPoint_hitarea',
    position,
    billboard: {
      image: hitCanvas,
      width: 52,
      height: 52,
      color: new Cesium.Color(1, 1, 1, 0.01),
    },
  });

  const entities = [outer, inner, center, hitArea];
  entities.forEach(e => viewer.entities.add(e));
  return entities;
}

// ─── Listing Markers ────────────────────────────────────────────

export interface ListingMarkerOptions {
  idPrefix: string;
  pointColor: string;
  getLabelText: (listing: Listing) => string;
  propertyKey: string;
  shape?: 'point' | 'fire';
}

const FIRE_SVG_TEMPLATE = (hexColor: string): string => `
<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
  <path
    d="M24 2
       C21 9 16 13 16 21
       C16 23 16.5 25 17.5 27
       C13 26 9 22 9 16
       C5 22 4 27 4 32
       C4 44 12 54 24 54
       C36 54 44 44 44 32
       C44 23 40 15 34 10
       C34 17 31 22 27 24
       C28 21 28.5 18.5 28.5 17
       C28.5 11.5 26 7 24 2Z"
    fill="${hexColor}"
  />
  <path
    d="M24 20
       C20 25 18 29 18 34
       C18 40 21.5 44 24 46
       C26.5 44 30 40 30 34
       C30 30 28.5 27 26 24
       C26.2 26.2 25.8 28.2 25 30
       C23.8 28.2 23.5 24.5 24 20Z"
    fill="#FFE7B3"
  />
</svg>
`;

function fireSvgDataUrl(color: string): string {
  const svg = FIRE_SVG_TEMPLATE(color);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

export async function renderListingMarkers(
  viewer: any,
  listings: Listing[],
  entities: Entity[],
  options: ListingMarkerOptions,
): Promise<Entity[]> {
  removeMarkers(viewer, entities);
  const result: Entity[] = [];
  if (!viewer) return result;

  const useFire = options.shape === 'fire';
  const fireImageUrl = useFire ? fireSvgDataUrl(options.pointColor) : null;

  for (const listing of listings) {
    const position = await clampToSurface(
      listing.location.longitude,
      listing.location.latitude,
    );

    const base: any = {
      id: `${options.idPrefix}${listing.id}`,
      position,
      label: {
        text: options.getLabelText(listing),
        font: 'bold 12px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: 50000,
      },
      properties: { [options.propertyKey]: listing },
    };

    if (useFire && fireImageUrl) {
      base.billboard = {
        image: fireImageUrl,
        width: 32,
        height: 44,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 50000,
      };
    } else {
      base.point = {
        pixelSize: 10,
        color: Color.fromCssColorString(options.pointColor),
        outlineColor: Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: 50000,
      };
    }

    const entity = viewer.entities.add(base);
    result.push(entity);
  }
  return result;
}

export function removeMarkers(viewer: any, entities: Entity[]): void {
  if (!viewer) return;
  for (const entity of entities) {
    viewer.entities.remove(entity);
  }
  entities.length = 0;
}

export function removeMarkerById(
  viewer: any,
  entities: Entity[],
  idPrefix: string,
  listingId: string,
): void {
  if (!viewer) return;
  const entityId = `${idPrefix}${listingId}`;
  const idx = entities.findIndex((e) => e.id === entityId);
  if (idx !== -1) {
    viewer.entities.remove(entities[idx]);
    entities.splice(idx, 1);
  }
}
