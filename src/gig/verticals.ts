/**
 * Gig Economy Vertical Configurations
 *
 * Each vertical defines labels, form fields, Nostr tags, and map styles.
 * Matching verticals use the real-time need/offer protocol.
 * Listing verticals use a publish-only model with longer TTL.
 */

import type { GigVertical, ListingCategory } from '../types';
import type { OuterRingItem } from './verticalIcons';

// ─── Form Field Definition ─────────────────────────────────────

export interface GigFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder: string;
  required: boolean;
  /** Regex string for per-field validation (tested when field is non-empty). */
  pattern?: string;
  /** Shown below the field when the pattern doesn't match. */
  patternHint?: string;
  /** Cross-field group name — at least one field in the group must be filled and valid. */
  group?: string;
}

// ─── Vertical Config (discriminated union) ──────────────────────

interface BaseVerticalConfig {
  id: GigVertical;
  name: string;
  color: string;
}

export interface MatchingVerticalConfig extends BaseVerticalConfig {
  mode: 'matching';

  // Menu labels
  needLabel: string;
  needDesc: string;
  offerLabel: string;
  offerDesc: string;

  // Whether the "need" form includes a map-pick for a second location
  hasDestination: boolean;

  // When true, the map-pick is the start (pickup) and GPS is the destination (dropoff)
  reverseLocations: boolean;

  // Labels for the two location fields in the need form
  gpsLocationLabel: string;
  mapPickLabel: string;

  // Extra form fields beyond GPS location (+ optional destination)
  needFields: GigFormField[];
  offerFields: GigFormField[];

  // Per-group contextual hints (keyed by group name, shown above grouped fields)
  needFieldGroupHints?: Record<string, string>;
  offerFieldGroupHints?: Record<string, string>;

  // Role nouns for status messages
  requesterNoun: string;
  providerNoun: string;
  requestNoun: string;

  // Match screen
  matchTitle: string;
  matchMessage: string;

  // Cesium map entity styles
  mapColor: string;
  mapDestColor: string;
  mapLabel: string;
}

export interface ListingVerticalConfig extends BaseVerticalConfig {
  mode: 'listing';
}

export type VerticalConfig = MatchingVerticalConfig | ListingVerticalConfig;

// ─── Helpout Categories ─────────────────────────────────────────

export const HELPOUT_CATEGORIES: ListingCategory[] = [
  { id: 'art-music', name: 'Art & Music', description: 'Instruments, singing, painting, photography' },
  { id: 'cooking', name: 'Cooking & Nutrition', description: 'Recipes, dietary guidance, baking, special diets' },
  { id: 'computers', name: 'Computers & Electronics', description: 'Software, programming, web design, IT support' },
  { id: 'business', name: 'Business & Career', description: 'Career coaching, communication, planning, marketing' },
  { id: 'finance', name: 'Finance & Legal', description: 'Taxes, investment advice, basic legal guidance' },
  { id: 'health', name: 'Health & Fitness', description: 'Yoga, meditation, workouts, nutrition, coaching' },
  { id: 'languages', name: 'Languages & Learning', description: 'Language lessons, exam prep, learning strategies' },
  { id: 'lifestyle', name: 'Lifestyle & Hobbies', description: 'DIY, crafting, travel, fashion, pets, gardening' },
  { id: 'other', name: 'Other / Specialty Skills', description: 'Everything else that doesn\'t fit standard categories' },
];

export const SOCIAL_CATEGORIES: ListingCategory[] = [
  { id: 'sports', name: 'Sports & Fitness', description: 'Running, cycling, football, tennis, yoga, workouts, swimming' },
  { id: 'outdoors', name: 'Outdoors & Nature', description: 'Hiking, nature walks, camping, picnics, climbing' },
  { id: 'games', name: 'Games & Fun', description: 'Board games, card games, e-gaming, trivia nights' },
  { id: 'nightlife', name: 'Social & Nightlife', description: 'Parties, bar groups, dinner groups, community hangouts' },
  { id: 'culture', name: 'Culture & Entertainment', description: 'Movies, concerts, theatre, art exhibitions, museums' },
  { id: 'food', name: 'Food & Drink', description: 'Group dinners, cooking together, food tasting, cafe meetups' },
  { id: 'learning', name: 'Learning & Skills', description: 'Language exchanges, workshops, study groups' },
  { id: 'travel', name: 'Travel & Excursions', description: 'Weekend trips, sightseeing tours, travel companions' },
  { id: 'family', name: 'Family & Kids', description: 'Activities for parents and children, family outings' },
  { id: 'creative', name: 'Creative & Arts', description: 'Music jamming, singing, drawing, painting groups' },
  { id: 'community', name: 'Other Community', description: 'Book clubs, photography walks, volunteering, hobby groups' },
];

// ─── Vertical Definitions ───────────────────────────────────────

export const VERTICALS: Record<GigVertical, VerticalConfig> = {
  rides: {
    id: 'rides',
    name: 'Rideshare',
    color: '#4285F4',
    mode: 'matching',
    needLabel: 'I need a Ride',
    needDesc: 'Request a ride in your area',
    offerLabel: 'I offer Rides',
    offerDesc: 'Drive people in your area',
    hasDestination: true,
    reverseLocations: false,
    gpsLocationLabel: 'Your Location',
    mapPickLabel: 'Destination',
    needFields: [],
    offerFields: [],
    requesterNoun: 'rider',
    providerNoun: 'driver',
    requestNoun: 'ride',
    matchTitle: 'Ride Matched!',
    matchMessage: 'Your ride has been confirmed.',
    mapColor: '#4285F4',
    mapDestColor: '#34A853',
    mapLabel: 'Ride',
  },

  delivery: {
    id: 'delivery',
    name: 'Delivery',
    color: '#FF6D00',
    mode: 'matching',
    needLabel: 'I need a Delivery',
    needDesc: 'Get something picked up & delivered',
    offerLabel: 'I deliver',
    offerDesc: 'Deliver items in your area',
    hasDestination: true,
    reverseLocations: true,
    gpsLocationLabel: 'Deliver to (Your Location)',
    mapPickLabel: 'Pickup Location',
    needFields: [
      { key: 'item', label: 'Item Description', type: 'text', placeholder: 'What needs to be delivered?', required: true },
    ],
    offerFields: [
      { key: 'phone', label: 'Phone Number', type: 'text', placeholder: '+49 170 1234567', required: false, pattern: '^\\+?[0-9\\s\\-]{4,20}$', patternHint: 'Digits only (optional + at start)', group: 'contact' },
      { key: 'messenger', label: 'Messenger Link', type: 'text', placeholder: 't.me/user or peer://invite-code', required: false, pattern: '^([a-zA-Z][a-zA-Z0-9+\\-.]*:\\/\\/.+|[a-zA-Z0-9-]+\\.[a-zA-Z]{2,}\\S*)$', patternHint: 'Enter a link (e.g. t.me/user, https://... or peer://...)', group: 'contact' },
    ],
    offerFieldGroupHints: {
      contact: 'Provide at least one way for customers to reach you. Mind not using too exotic apps so customers have a chance of contacting you \u2014 also note that some P2P protocols may not work in certain countries.',
    },
    requesterNoun: 'customer',
    providerNoun: 'courier',
    requestNoun: 'delivery',
    matchTitle: 'Delivery Matched!',
    matchMessage: 'A courier has been matched to your delivery.',
    mapColor: '#FF6D00',
    mapDestColor: '#34A853',
    mapLabel: 'Delivery',
  },

  helpouts: {
    id: 'helpouts',
    name: 'Helpout',
    color: '#00BCD4',
    mode: 'listing',
  },

  social: {
    id: 'social',
    name: 'Spontaneous Contacts',
    color: '#FF4081',
    mode: 'listing',
  },
};

/** Ordered list of verticals for the selector UI. */
export const VERTICAL_LIST: GigVertical[] = ['rides', 'delivery', 'helpouts', 'social'];

/**
 * Unified radial menu items — single ring, 8 items at 45° intervals.
 *
 * Clockwise from top:
 *   Spontaneous Contacts (top)
 *   ── right half: actions ──
 *   Brainstorming, MeetandDo, Petition, Crowdfunding
 *   ── left half: gig verticals ──
 *   Helpout, Delivery, Rideshare
 */
export type RadialMenuItem =
  | { kind: 'vertical'; id: GigVertical; name: string; color: string }
  | { kind: 'action';   id: OuterRingItem; name: string; color: string; description: string };

export const RADIAL_MENU_ITEMS: RadialMenuItem[] = [
  { kind: 'vertical', id: 'social',        name: 'Spontaneous Contacts', color: '#FF4081' },
  { kind: 'action',   id: 'brainstorming', name: 'Brainstorming',        color: '#FFCA28',
    description: 'Flip the script on every bad news! Take every flood, fire, drought, blackout, eviction, protest, injustice, crisis, or failure\u2014or any everyday issue, whether local or global\u2014and turn it into a public brainstorm. Open to everyone, including entrepreneurs, to brainstorm their own challenges and co-create innovative products, services, and solutions.' },
  { kind: 'action',   id: 'meetanddo',     name: 'MeetandDo',            color: '#66BB6A',
    description: 'From idea to impact\u2014organize real-world missions with local teams. Rally your community, show up, and take action where it counts.' },
  { kind: 'action',   id: 'petition',      name: 'Petition',             color: '#AB47BC',
    description: 'Make your voice count. Push for change, win approvals, and unlock collective power to reshape spaces, systems, and policies.' },
  { kind: 'action',   id: 'crowdfunding',  name: 'Crowdfunding',         color: '#EF5350',
    description: 'Fuel your mission. Raise the resources to launch your project and solutions\u2014and turn bold ideas into real-world transformations.' },
  { kind: 'vertical', id: 'helpouts',      name: 'Helpout',              color: '#00BCD4' },
  { kind: 'vertical', id: 'delivery',      name: 'Delivery',             color: '#FF6D00' },
  { kind: 'vertical', id: 'rides',         name: 'Rideshare',            color: '#4285F4' },
];
