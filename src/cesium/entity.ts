import * as Cesium from 'cesium';

/**
 * Generic Cesium entity add/remove.
 *
 * Unlike marker.ts (which owns a specific, opinionated point-marker look)
 * or route.ts (a specific preview shape), this module is a thin, unopinionated
 * pass-through to Cesium's own entity collection. It exists so components can
 * add arbitrary entities (polylines, polygons, billboards, labels, ...) and
 * later remove them again by the id they were given, without reaching past
 * cesium/api.ts into Cesium internals.
 */

/** Same shape Cesium itself accepts, minus `id` — that's supplied separately so every entity is addressed consistently. */
export type EntityOptions = Omit<Cesium.Entity.ConstructorOptions, 'id'>;

/**
 * Add an entity under the given id. If an entity with that id already
 * exists, Cesium throws — callers should remove() first if they intend to
 * replace one.
 */
export function addEntity(viewer: Cesium.Viewer, id: string, options: EntityOptions): Cesium.Entity {
  return viewer.entities.add({ ...options, id });
}

/** Remove the entity with the given id. Returns false (no-op) if no such entity exists. */
export function removeEntity(viewer: Cesium.Viewer, id: string): boolean {
  return viewer.entities.removeById(id);
}