import { writable, type Writable } from 'svelte/store';

interface Coordinates {
  latitude: string;
  longitude: string;
}

export const coordinates: Writable<Coordinates> = writable({
  latitude: '',
  longitude: ''
});
