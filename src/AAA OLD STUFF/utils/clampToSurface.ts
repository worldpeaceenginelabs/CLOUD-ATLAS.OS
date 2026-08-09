import { get } from 'svelte/store';
import { viewer } from '../store';
import { Cartesian3 } from 'cesium';

/**
 * Waits for 3D tileset tiles to load, then returns a Cartesian3 snapped to the
 * rendered surface. Use for any marker placed from coordinates (GPS, address
 * search, relay data) rather than a user click (which should use pickPosition).
 */
export async function clampToSurface(longitude: number, latitude: number): Promise<Cartesian3> {
	const rough = Cartesian3.fromDegrees(longitude, latitude, 0);
	const v = get(viewer);
	if (!v) return rough;
	try {
		const [clamped] = await v.scene.clampToHeightMostDetailed([rough]);
		return clamped ?? rough;
	} catch {
		return rough;
	}
}
