/**
 * Shared Type Definitions for Cloud Atlas OS
 * Consolidates duplicate interfaces from store.ts and idb.ts
 */

export interface Coordinates {
  latitude: string;
  longitude: string;
  height: number;
}

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
  roaming?: {
    isEnabled: boolean;
    area: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null;
    speed: number; // meters per second
  };
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

// Modal Management Types
export type ModalType = 'default' | 'notification' | 'overlay' | 'card';

export interface ModalConfig {
  id: string;
  type: ModalType;
  title?: string;
  maxWidth?: string;
  zIndex?: number;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  transitionDuration?: number;
  customClass?: string;
  forwardInputs?: boolean;
  data?: any;
}

export interface ModalState {
  id: string;
  config: ModalConfig;
  isVisible: boolean;
  timestamp: number;
  zIndex: number;
}

export interface ModalHistory {
  modals: string[];
  currentIndex: number;
}