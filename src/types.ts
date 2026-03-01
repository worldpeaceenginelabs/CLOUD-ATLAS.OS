/**
 * Shared Type Definitions for Cloud Atlas OS
 * Consolidates duplicate interfaces from store.ts and idb.ts
 */

export interface Coordinates {
  latitude: string;
  longitude: string;
  height: number;
}

// ─── Geo Primitives ──────────────────────────────────────────

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface AreaBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ─── Behavior System ─────────────────────────────────────────

export type Behavior =
  | RoamBehavior
  | PathBehavior
  | OrbitBehavior
  | FollowBehavior
  | HerdBehavior;

export interface RoamBehavior {
  type: 'roam';
  area: AreaBounds;
  speed: number;
}

export interface PathBehavior {
  type: 'path';
  waypoints: LatLon[];
  speed: number;
  loop: boolean;
  clampToGround: boolean;
}

export interface OrbitBehavior {
  type: 'orbit';
  targetModelId: string;
  radius: number;
  speed: number;
  axis: 'y' | 'x' | 'z';
}

export interface FollowBehavior {
  type: 'follow';
  targetModelId: string;
  offset: { x: number; y: number; z: number };
  speed: number;
}

export type LocalMotion =
  | { type: 'circle'; radius: number; speed: number }
  | { type: 'figure8'; width: number; speed: number }
  | { type: 'wander'; radius: number; speed: number }
  | { type: 'fixed' };

export interface HerdMember {
  id: string;
  localOffset: { x: number; y: number };
  localMotion: LocalMotion;
  scale: number;
  phaseOffset: number;
}

export interface HerdBehavior {
  type: 'herd';
  count: number;
  members: HerdMember[];
  motionPattern: 'circle' | 'figure8' | 'wander' | 'fixed';
  motionRadius: number;
  motionSpeed: number;
  canvas: RoamBehavior | PathBehavior;
}

// ─── Interaction System ──────────────────────────────────────

export type Action =
  | { type: 'visibility'; visible: boolean }
  | { type: 'animation'; clipName: string }
  | { type: 'transform'; scale?: number; rotation?: { heading: number; pitch: number; roll: number } }
  | { type: 'notify'; message: string };

export type InteractionConfig =
  | { type: 'proximity'; radius: number; action: Action }
  | { type: 'collision'; action: Action }
  | { type: 'trigger-zone'; bounds: AreaBounds; action: Action };

export interface Interaction {
  id: string;
  sourceId: string;
  targetId?: string;
  config: InteractionConfig;
}

// ─── Scene ───────────────────────────────────────────────────

export interface SceneModelData {
  id: string;
  name: string;
  source: 'file' | 'url';
  url?: string;
  file?: File;
  localPosition: { x: number; y: number; z: number };
  rotation: { heading: number; pitch: number; roll: number };
  scale: number;
  behavior?: Behavior;
  tags: string[];
}

export interface SceneData {
  id: string;
  name: string;
  description: string;
  origin: LatLon;
  models: SceneModelData[];
  interactions: Interaction[];
  timestamp: string;
}

// ─── Model (standalone placement on the globe) ───────────────

export interface ModelData {
  id: string;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transform: {
    scale: number;
    height: number;
    heading: number;
    pitch: number;
    roll: number;
    heightOffset: number;
  };
  source: 'file' | 'url';
  url?: string;
  file?: File;
  timestamp: string;
  behavior?: Behavior;
}

// Gig Economy Types
export type GigVertical = 'rides' | 'delivery' | 'helpouts' | 'social' | 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

/** Subset of GigVertical that uses the listing (publish-only) model. */
export type ListingVertical = 'helpouts' | 'social' | 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

// Listing types
export type ListingMode = 'in-person' | 'online' | 'both';

export interface ListingCategory {
  id: string;
  name: string;
  description: string;
}

export interface Listing {
  id: string;
  pubkey: string;
  mode: ListingMode;
  category: string;
  description: string;
  contact: string;
  title?: string;       // social events
  eventDate?: string;   // social events (ISO 8601)
  location?: {
    latitude: number;
    longitude: number;
  };
  address?: string;     // human-readable address from Nominatim
  timestamp: string;
  geohash?: string;
  /** Set when fetched from Swarm Governance combined feed (from event #t). */
  vertical?: ListingVertical;
}

export interface GigRequest {
  id: string;
  pubkey: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
  };
  status: 'open' | 'taken' | 'cancelled';
  matchedProviderPubkey: string | null;
  geohash: string;
  /** Vertical-specific form data (item description, guest count, etc.) */
  details: Record<string, string>;
}
