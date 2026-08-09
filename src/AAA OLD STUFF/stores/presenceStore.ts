import { writable } from 'svelte/store';

export const onlineNowCount = writable(0);
export const seen24hCount = writable(0);

/** Active geohash-5 cells with at least one online user. */
export const onlineGeohash5Cells = writable<Set<string>>(new Set());

/** Toggle rendering online-cell overlay in Cesium. */
export const showOnlineCellsOverlay = writable(false);

