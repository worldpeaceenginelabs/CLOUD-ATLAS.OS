/**
 * Gig Economy Vertical Configurations
 *
 * Each vertical defines labels, form fields, Nostr tags, and map styles.
 * Matching verticals use the real-time need/offer protocol.
 * Listing verticals use a publish-only model with longer TTL.
 */

import type { GigVertical, ListingVertical, ListingCategory } from '../types';

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
  /** Nostr '#t' tag suffix, e.g. 'helpouts' → tag 'listing-helpouts' */
  listingTag: string;
  /** Entity prefix on the Cesium map, e.g. 'helpout_' */
  mapPrefix: string;
  /** Form title shown at the top of ListingForm */
  formTitle: string;
  /** Subtitle below the form title */
  formSubtitle: string;
  /** Label for the title input field */
  titleLabel: string;
  /** Placeholder for the title input */
  titlePlaceholder: string;
  /** Placeholder for the description textarea */
  descriptionPlaceholder: string;
  /** Label for the contact input */
  contactLabel: string;
  /** Placeholder for the contact input */
  contactPlaceholder: string;
  /** Hint text shown below the contact input */
  contactHint: string;
  /** Regex pattern for contact field validation (optional — accepts any non-empty string if absent) */
  contactPattern?: string;
  /** Hint shown when the contact pattern fails */
  contactPatternHint?: string;
  /** Whether this vertical has an event date field */
  hasEventDate?: boolean;
  /** Submit button label */
  submitLabel: string;
  /** Label shown on the "live" confirmation screen */
  liveTitle: string;
  /** Hint on the "live" confirmation screen */
  liveHint: string;
  /** Button label in ListingDetail for contacting the author */
  contactButtonLabel: string;
  /** Label for take-down button in ListingDetail */
  takeDownLabel: string;
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

/** Look up the category list for any listing vertical. */
export const LISTING_CATEGORIES: Record<ListingVertical, ListingCategory[]> = {
  helpouts: HELPOUT_CATEGORIES,
  social: SOCIAL_CATEGORIES,
  brainstorming: [],
  meetanddo: [],
  petition: [],
  crowdfunding: [],
};

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
      { key: 'messenger', label: 'Contact Link', type: 'text', placeholder: 't.me/user or peer://invite-code', required: false, pattern: '^([a-zA-Z][a-zA-Z0-9+\\-.]*:\\/\\/.+|[a-zA-Z0-9-]+\\.[a-zA-Z]{2,}\\S*)$', patternHint: 'Enter a link (e.g. t.me/user, https://... or peer://...)', group: 'contact' },
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
    listingTag: 'listing-helpouts',
    mapPrefix: 'helpout_',
    formTitle: 'Offer a Helpout',
    formSubtitle: 'Share your expertise with people nearby',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Guitar Lessons, Math Tutoring...',
    descriptionPlaceholder: 'What can you help with? Describe your expertise...',
    contactLabel: 'Contact Link',
    contactPlaceholder: 'e.g. https://t.me/you, https://wa.me/123...',
    contactHint: 'Telegram, WhatsApp, Signal, Zoom, or any link',
    submitLabel: 'Publish Listing',
    liveTitle: 'Your Listing is Live!',
    liveHint: 'Your helpout will appear on the map for 14 days. People can contact you directly via your contact link. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Contact',
    takeDownLabel: 'Take Down Listing',
  },

  social: {
    id: 'social',
    name: 'Spontaneous Contacts',
    color: '#FF4081',
    mode: 'listing',
    listingTag: 'listing-social',
    mapPrefix: 'social_',
    formTitle: 'Host an Event',
    formSubtitle: 'Organize a meetup or activity for people nearby',
    titleLabel: 'Event Title',
    titlePlaceholder: 'e.g. Saturday Morning Run, Board Game Night...',
    descriptionPlaceholder: "What's the plan? Describe the activity...",
    contactLabel: 'Contact Link',
    contactPlaceholder: 'e.g. https://t.me/you, https://wa.me/123...',
    contactHint: 'Telegram, WhatsApp, Signal, or any link for attendees to reach you',
    hasEventDate: true,
    submitLabel: 'Publish Event',
    liveTitle: 'Your Event is Live!',
    liveHint: 'Your event will appear on the map for 14 days. People can contact you directly via your contact link. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Contact Host',
    takeDownLabel: 'Take Down Event',
  },

  brainstorming: {
    id: 'brainstorming',
    name: 'Brainstorming',
    color: '#FFCA28',
    mode: 'listing',
    listingTag: 'listing-brainstorming',
    mapPrefix: 'brainstorm_',
    formTitle: 'Start a Brainstorm',
    formSubtitle: 'Turn any issue into a public brainstorm — open to everyone',
    titleLabel: 'Mission Title',
    titlePlaceholder: 'Enter a short, powerful mission name — max 100 chars',
    descriptionPlaceholder: "What's the mission in a nutshell?",
    contactLabel: 'Zoom Link',
    contactPlaceholder: 'https://us05web.zoom.us/j/ID?pwd=12345',
    contactHint: 'Zoom meeting link where the brainstorm takes place',
    contactPattern: '^https:\\/\\/(us05web\\.)?zoom\\.us\\/j\\/\\d+',
    contactPatternHint: 'Must be a valid Zoom link (https://zoom.us/j/...)',
    submitLabel: 'Publish Brainstorm',
    liveTitle: 'Your Brainstorm is Live!',
    liveHint: 'Your brainstorm session will appear on the map for 14 days. People can join via the Zoom link. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Join Brainstorm',
    takeDownLabel: 'Take Down Brainstorm',
  },

  meetanddo: {
    id: 'meetanddo',
    name: 'MeetandDo',
    color: '#66BB6A',
    mode: 'listing',
    listingTag: 'listing-meetanddo',
    mapPrefix: 'meetanddo_',
    formTitle: 'Organize a Mission',
    formSubtitle: 'Rally your community, show up, and take action',
    titleLabel: 'Mission Title',
    titlePlaceholder: 'e.g. Park Cleanup, Community Garden Build...',
    descriptionPlaceholder: 'Describe the mission — what, where, when, and what people should bring',
    contactLabel: 'Telegram Group Link',
    contactPlaceholder: 'https://t.me/+rtygFbFZrJE5NjIy',
    contactHint: 'Telegram group where participants coordinate',
    contactPattern: '^(?:https?:\\/\\/)?(?:t\\.me|telegram\\.me|t\\.dog|telegram\\.dog)\\/(?:joinchat\\/|\\+)?([\\w-]+)$',
    contactPatternHint: 'Must be a valid Telegram link (https://t.me/...)',
    submitLabel: 'Publish Mission',
    liveTitle: 'Your Mission is Live!',
    liveHint: 'Your mission will appear on the map for 14 days. People can join via Telegram. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Join Mission',
    takeDownLabel: 'Take Down Mission',
  },

  petition: {
    id: 'petition',
    name: 'Petition',
    color: '#AB47BC',
    mode: 'listing',
    listingTag: 'listing-petition',
    mapPrefix: 'petition_',
    formTitle: 'Start a Petition',
    formSubtitle: 'Push for change — win approvals and unlock collective power',
    titleLabel: 'Petition Title',
    titlePlaceholder: 'e.g. Save the Old Oak Tree, Bike Lane for Main St...',
    descriptionPlaceholder: 'What change are you demanding? Why does it matter?',
    contactLabel: 'Change.org Link',
    contactPlaceholder: 'https://www.change.org/p/your-petition-name',
    contactHint: 'Link to the petition on Change.org',
    contactPattern: '^https:\\/\\/(www\\.)?change\\.org\\/p\\/[a-zA-Z0-9-]+\\/?$',
    contactPatternHint: 'Must be a valid Change.org petition link',
    submitLabel: 'Publish Petition',
    liveTitle: 'Your Petition is Live!',
    liveHint: 'Your petition will appear on the map for 14 days. People can sign it via the link. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Sign Petition',
    takeDownLabel: 'Take Down Petition',
  },

  crowdfunding: {
    id: 'crowdfunding',
    name: 'Crowdfunding',
    color: '#EF5350',
    mode: 'listing',
    listingTag: 'listing-crowdfunding',
    mapPrefix: 'crowdfunding_',
    formTitle: 'Launch a Campaign',
    formSubtitle: 'Raise resources to turn bold ideas into real-world impact',
    titleLabel: 'Campaign Title',
    titlePlaceholder: 'e.g. Solar Panels for Community Center...',
    descriptionPlaceholder: 'What are you raising funds for? How will it make a difference?',
    contactLabel: 'GoFundMe Link',
    contactPlaceholder: 'https://www.gofundme.com/f/your-campaign-name',
    contactHint: 'Link to the campaign on GoFundMe',
    contactPattern: '^https:\\/\\/(www\\.)?gofundme\\.com\\/f\\/[a-zA-Z0-9-]+\\/?$',
    contactPatternHint: 'Must be a valid GoFundMe link',
    submitLabel: 'Publish Campaign',
    liveTitle: 'Your Campaign is Live!',
    liveHint: 'Your campaign will appear on the map for 14 days. People can donate via the link. You can take it down anytime by tapping your marker on the map.',
    contactButtonLabel: 'Donate',
    takeDownLabel: 'Take Down Campaign',
  },
};

/** Ordered list of verticals for the selector UI. */
export const VERTICAL_LIST: GigVertical[] = [
  'rides', 'delivery', 'helpouts', 'social',
  'brainstorming', 'meetanddo', 'petition', 'crowdfunding',
];

/** Only the listing-mode verticals, for layer management. */
export const LISTING_VERTICALS: ListingVertical[] = [
  'helpouts', 'social', 'brainstorming', 'meetanddo', 'petition', 'crowdfunding',
];

/**
 * Unified radial menu items — single ring, 8 items at 45° intervals.
 *
 * Clockwise from top:
 *   Spontaneous Contacts (top)
 *   Brainstorming, MeetandDo, Petition, Crowdfunding
 *   Helpout, Delivery, Rideshare
 */
export interface RadialMenuItem {
  kind: 'vertical';
  id: GigVertical;
  name: string;
  color: string;
  description?: string;
}

export const RADIAL_MENU_ITEMS: RadialMenuItem[] = [
  { kind: 'vertical', id: 'social',        name: 'Spontaneous Contacts', color: '#FF4081' },
  { kind: 'vertical', id: 'brainstorming', name: 'Brainstorming',        color: '#FFCA28',
    description: 'Flip the script on every bad news! Take every flood, fire, drought, blackout, eviction, protest, injustice, crisis, or failure\u2014or any everyday issue, whether local or global\u2014and turn it into a public brainstorm. Open to everyone, including entrepreneurs, to brainstorm their own challenges and co-create innovative products, services, and solutions.' },
  { kind: 'vertical', id: 'meetanddo',     name: 'MeetandDo',            color: '#66BB6A',
    description: 'From idea to impact\u2014organize real-world missions with local teams. Rally your community, show up, and take action where it counts.' },
  { kind: 'vertical', id: 'petition',      name: 'Petition',             color: '#AB47BC',
    description: 'Make your voice count. Push for change, win approvals, and unlock collective power to reshape spaces, systems, and policies.' },
  { kind: 'vertical', id: 'crowdfunding',  name: 'Crowdfunding',         color: '#EF5350',
    description: 'Fuel your mission. Raise the resources to launch your project and solutions\u2014and turn bold ideas into real-world transformations.' },
  { kind: 'vertical', id: 'helpouts',      name: 'Helpout',              color: '#00BCD4' },
  { kind: 'vertical', id: 'delivery',      name: 'Delivery',             color: '#FF6D00' },
  { kind: 'vertical', id: 'rides',         name: 'Rideshare',            color: '#4285F4' },
];
