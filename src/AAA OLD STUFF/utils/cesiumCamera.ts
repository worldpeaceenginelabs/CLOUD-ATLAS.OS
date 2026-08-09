import type { Viewer, Cesium3DTileset, CustomDataSource } from 'cesium';
import type { Writable, Readable } from 'svelte/store';
import { get } from 'svelte/store';

export interface CameraMonitorHandle {
  start(): void;
  stop(): void;
  updateHeight(): void;
  cleanup(): void;
}

export interface CameraMonitorDeps {
  viewer: Viewer;
  getTileset(): Cesium3DTileset | null;
  getModelDataSource(): CustomDataSource | null;
  currentHeight: Writable<number>;
  enable3DTileset: Readable<boolean>;
  is3DTilesetActive: Writable<boolean>;
}

const HEIGHT_CHECK_INTERVAL = 100;

export function initCameraMonitor(deps: CameraMonitorDeps): CameraMonitorHandle {
  let isMonitoring = false;
  let animationFrameId: number | null = null;
  let lastHeightCheck = 0;

  function updateHeight() {
    deps.currentHeight.set(deps.viewer.camera.positionCartographic.height);
  }

  function tick() {
    if (!isMonitoring) return;

    const now = performance.now();
    if (now - lastHeightCheck < HEIGHT_CHECK_INTERVAL) {
      animationFrameId = requestAnimationFrame(tick);
      return;
    }

    lastHeightCheck = now;
    const height = deps.viewer.camera.positionCartographic.height;
    deps.currentHeight.set(height);

    const tileset = deps.getTileset();
    const modelDS = deps.getModelDataSource();
    const tilesetEnabled = get(deps.enable3DTileset);

    if (tilesetEnabled && tileset) {
      if (height > 6000000) {
        if (get(deps.is3DTilesetActive)) {
          deps.viewer.scene.globe.show = true;
          tileset.show = false;
          deps.is3DTilesetActive.set(false);
          if (modelDS) modelDS.show = false;
        }
      } else {
        if (!get(deps.is3DTilesetActive)) {
          deps.viewer.scene.globe.show = false;
          tileset.show = true;
          deps.is3DTilesetActive.set(true);
          if (modelDS) modelDS.show = true;
        }
      }
    } else {
      deps.viewer.scene.globe.show = true;
      if (tileset) tileset.show = false;
      deps.is3DTilesetActive.set(false);
      const showEntities = height <= 6000000;
      if (modelDS) modelDS.show = showEntities;
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  function start() {
    if (!isMonitoring) {
      isMonitoring = true;
      tick();
    }
  }

  function stop() {
    isMonitoring = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function cleanup() {
    stop();
  }

  return { start, stop, updateHeight, cleanup };
}
