import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export async function loadCityLabels(viewer: Viewer, url = '/cities.json', count = 1200): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch cities: ${response.status}`);

  const cities = await response.json();
  const labels = viewer.scene.primitives.add(new Cesium.LabelCollection());
  const sample = cities.slice(0, count);

  for (const city of sample) {
    const lat = parseFloat(city.lat);
    const lon = parseFloat(city.lng);
    if (isNaN(lat) || isNaN(lon)) continue;

    labels.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      text: city.name,
      font: '24px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      scaleByDistance: new Cesium.NearFarScalar(1.0, 1.0, 2.0e7, 0.0),
      eyeOffset: new Cesium.Cartesian3(0.0, 0.0, -12500),
    });
  }
}
