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

const PICKED_POINT_STYLE = {
  pixelSize: 8,
  color: Color.fromCssColorString('#34A853'),
  outlineColor: Color.WHITE,
  outlineWidth: 1,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
} as const;

export function addPickedPointMarker(
  viewer: any,
  position: any,
  existingEntity: Entity | null,
): Entity | null {
  if (!viewer) return null;
  if (existingEntity) viewer.entities.remove(existingEntity);
  return viewer.entities.add({
    id: 'pickedPoint',
    position,
    point: { ...PICKED_POINT_STYLE },
  });
}

// ─── Listing Markers ────────────────────────────────────────────

export interface ListingMarkerOptions {
  idPrefix: string;
  pointColor: string;
  getLabelText: (listing: Listing) => string;
  propertyKey: string;
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

  for (const listing of listings) {
    if (!listing.location) continue;
    const position = await clampToSurface(
      listing.location.longitude,
      listing.location.latitude,
    );
    const entity = viewer.entities.add({
      id: `${options.idPrefix}${listing.id}`,
      position,
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString(options.pointColor),
        outlineColor: Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: options.getLabelText(listing),
        font: 'bold 12px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: { [options.propertyKey]: listing },
    });
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
