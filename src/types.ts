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
