import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { encode, decode } from './geohash';

const HEIGHT_P6_MAX_M = 15000;

function precisionFromHeight(height: number): 6 | null {
  if (height <= HEIGHT_P6_MAX_M) return 6;
  return null;
}

export interface GeohashGridHandle {
  cleanup(): void;
}

export function initGeohashGrid(viewer: Viewer): GeohashGridHandle {
  const dataSource = new Cesium.CustomDataSource('geohashGrid');
  viewer.dataSources.add(dataSource);

  const scratchRectangle = new Cesium.Rectangle();
  let rafId: number | null = null;
  let scheduled = false;
  let isMoving = false;

  function update() {
    scheduled = false;
    if (!viewer.scene.globe.ellipsoid) return;

    if (isMoving) {
      dataSource.show = false;
      return;
    }

    const height = viewer.camera.positionCartographic.height;
    const precision = precisionFromHeight(height);
    if (precision == null) {
      dataSource.show = false;
      dataSource.entities.removeAll();
      return;
    }

    const rect = viewer.camera.computeViewRectangle(
      viewer.scene.globe.ellipsoid,
      scratchRectangle,
    );
    if (!rect) {
      dataSource.show = false;
      dataSource.entities.removeAll();
      return;
    }

    const west = Cesium.Math.toDegrees(rect.west);
    const south = Cesium.Math.toDegrees(rect.south);
    const east = Cesium.Math.toDegrees(rect.east);
    const north = Cesium.Math.toDegrees(rect.north);

    const cells = new Set<string>();
    const g0 = encode(south, west, precision);
    const d = decode(g0);

    const latStart = d.lat - d.latDelta / 2;
    const latEnd = north + d.latDelta * 0.6;
    const lonEnd = east + d.lonDelta * 0.6;

    for (let lat = latStart; lat <= latEnd; lat += d.latDelta) {
      const latClamp = Math.max(-90, Math.min(90, lat));
      for (let lon = d.lon - d.lonDelta / 2; lon <= lonEnd; lon += d.lonDelta) {
        let lonWrapped = lon;
        while (lonWrapped > 180) lonWrapped -= 360;
        while (lonWrapped < -180) lonWrapped += 360;
        cells.add(encode(latClamp, lonWrapped, precision));
      }
    }

    dataSource.show = true;
    dataSource.entities.removeAll();

    const gridColor = Cesium.Color.CYAN.withAlpha(0.7);
    for (const geohash of cells) {
      const { lat, lon, latDelta, lonDelta } = decode(geohash);
      const w = lon - lonDelta / 2;
      const s = lat - latDelta / 2;
      const e = lon + lonDelta / 2;
      const n = lat + latDelta / 2;

      dataSource.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            w, s, e, s, e, n, w, n, w, s,
          ]),
          width: 1,
          material: gridColor,
          clampToGround: false,
        },
      });

      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        label: {
          text: geohash,
          font: '12px sans-serif',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }

  function handleMoveStart() {
    isMoving = true;
    dataSource.show = false;
  }

  function handleMoveEnd() {
    isMoving = false;
    const heightM = viewer.camera.positionCartographic.height;
    scheduleUpdate();
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      update();
    });
  }

  viewer.camera.moveStart.addEventListener(handleMoveStart);
  viewer.camera.moveEnd.addEventListener(handleMoveEnd);
  scheduleUpdate();

  function cleanup() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    viewer.camera.moveStart.removeEventListener(handleMoveStart);
    viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
    dataSource.entities.removeAll();
    viewer.dataSources.remove(dataSource);
  }

  return { cleanup };
}
