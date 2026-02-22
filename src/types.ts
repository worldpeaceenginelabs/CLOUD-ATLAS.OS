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
export type GigVertical = 'rides' | 'delivery' | 'helpouts' | 'social';

// Listing types (shared by Helpouts and Social)
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

// App Menu Categories
export type AppMenuCategory = 'actionevent' | 'brainstorming' | 'crowdfunding' | 'petition';

// Link validation patterns for different categories
export const LINK_PATTERNS: Record<AppMenuCategory, RegExp> = {
  actionevent: /^(?:https?:\/\/)?(?:t\.me|telegram\.me|t\.dog|telegram\.dog)\/(?:joinchat\/|\+)?([\w-]+)$/i,
  brainstorming: /^https:\/\/(us05web\.)?zoom\.us\/j\/\d+/,
  crowdfunding: /^https:\/\/(www\.)?gofundme\.com\/f\/[a-zA-Z0-9-]+\/?$/,
  petition: /^https:\/\/(www\.)?change\.org\/p\/[a-zA-Z0-9-]+\/?$/
};

// Placeholder text for different categories
export const PLACEHOLDER_TEXT: Record<AppMenuCategory, { label: string; placeholder: string }> = {
  actionevent: {
    label: 'Telegram Group Link',
    placeholder: 'https://t.me/+rtygFbFZrJE5NjIy'
  },
  brainstorming: {
    label: 'Zoom.us Link',
    placeholder: 'https://us05web.zoom.us/j/ID?pwd=12345 or https://zoom.us/j/ID?pwd=12345'
  },
  crowdfunding: {
    label: 'GoFundMe.org Link',
    placeholder: 'https://www.gofundme.com/f/your-campaign-name'
  },
  petition: {
    label: 'Change.org Link',
    placeholder: 'https://www.change.org/p/your-petition-name'
  }
};

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