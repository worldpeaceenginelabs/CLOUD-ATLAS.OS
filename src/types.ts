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

export interface PinData {
  mapid: string;
  latitude: string;
  longitude: string;
  category: string;
  title: string;
  text: string;
  link: string;
  timestamp: string;
  height: number;
  [key: string]: any; // Add index signature for Trystero compatibility
}

export interface LocalPinData {
  mapid: string;
  latitude: string;
  longitude: string;
  category: string;
  title: string;
  text: string;
  link: string;
  timestamp: string;
  height: number;
}

// Gig Economy Types
export type RideType = 'person' | 'delivery';
export type GigRole = 'rider' | 'driver';
export type RideStatus = 'pending' | 'matched' | 'accepted' | 'rejected' | 'cancelled' | 'completed';

export interface RideRequest {
  id: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  rideType: RideType;
  status: RideStatus;
  matchedDriverId: string | null;
  timestamp: string;
  requesterId: string;
  [key: string]: any; // Trystero compatibility
}

export interface DriverOffer {
  id: string;
  currentLocation: {
    latitude: number;
    longitude: number;
  };
  radiusKm: number;
  isAvailable: boolean;
  timestamp: string;
  driverId: string;
  [key: string]: any; // Trystero compatibility
}

// App Menu Categories
export type AppMenuCategory = 'actionevent' | 'brainstorming' | 'crowdfunding' | 'petition';

// Link validation patterns for different categories
export const LINK_PATTERNS: Record<AppMenuCategory, RegExp> = {
  actionevent: /^(?:https?:\/\/)?(?:t\.me|telegram\.me|t\.dog|telegram\.dog)\/(?:joinchat\/|\+)?([\w-]+)$/i,
  brainstorming: /^https:\/\/(us05web\.)?zoom\.us\/j\/\d+/,
  crowdfunding: /^https:\/\/(www\.)?gofundme\.com\/f\/[a-zA-Z0-9-]+\/?$/,
  petition: /^https:\/\/(www\.)?change\.org\/petitions\/[a-zA-Z0-9-]+\/?$/
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