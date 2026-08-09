import { Math as CesiumMath } from 'cesium';
import type { Viewer } from 'cesium';

const PITCH_MIN = CesiumMath.toRadians(-90);
const PITCH_MAX = CesiumMath.toRadians(-5);
const TILT_SENSITIVITY = 0.003;
const PARALLEL_DRAG_THRESHOLD = 1.5; // parallel drag must exceed pinch delta by this factor

let viewer: Viewer | null = null;
let prevFingerDist = 0;
let prevAvgY = 0;
let isTracking = false;

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const dx = e.touches[1].clientX - e.touches[0].clientX;
    const dy = e.touches[1].clientY - e.touches[0].clientY;
    prevFingerDist = Math.sqrt(dx * dx + dy * dy);
    prevAvgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    isTracking = true;
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isTracking || !viewer || e.touches.length !== 2) return;

  const dx = e.touches[1].clientX - e.touches[0].clientX;
  const dy = e.touches[1].clientY - e.touches[0].clientY;
  const currentDist = Math.sqrt(dx * dx + dy * dy);
  const pinchDelta = Math.abs(currentDist - prevFingerDist);

  const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  const parallelDelta = Math.abs(avgY - prevAvgY);

  if (parallelDelta > pinchDelta * PARALLEL_DRAG_THRESHOLD && parallelDelta > 2) {
    e.preventDefault();

    const camera = viewer.camera;
    const tiltAmount = (avgY - prevAvgY) * TILT_SENSITIVITY;
    const newPitch = CesiumMath.clamp(
      camera.pitch + tiltAmount,
      PITCH_MIN,
      PITCH_MAX,
    );

    camera.setView({
      orientation: {
        heading: camera.heading,
        pitch: newPitch,
        roll: 0,
      },
    });
  }

  prevFingerDist = currentDist;
  prevAvgY = avgY;
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) {
    isTracking = false;
  }
}

export function setupTouchTiltHandler(cesiumViewer: Viewer): void {
  viewer = cesiumViewer;
  const container = document.getElementById('cesiumContainer');
  if (!container) return;

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
}

export function destroyTouchTiltHandler(): void {
  const container = document.getElementById('cesiumContainer');
  if (container) {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
  }
  viewer = null;
  isTracking = false;
}
