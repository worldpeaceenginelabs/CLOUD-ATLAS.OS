/**
 * Gig Economy Vertical Configurations
 *
 * Each vertical defines labels, form fields, Nostr tags, and map styles.
 * The matching protocol is identical across verticals — only the UI and
 * event tags differ.
 */

import type { GigVertical } from '../types';

// ─── Form Field Definition ─────────────────────────────────────

export interface GigFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder: string;
  required: boolean;
}

// ─── Vertical Config ────────────────────────────────────────────

export interface VerticalConfig {
  id: GigVertical;
  name: string;
  color: string;

  // Menu labels
  needLabel: string;
  needDesc: string;
  offerLabel: string;
  offerDesc: string;

  // Whether the "need" form includes a destination map-pick
  hasDestination: boolean;

  // Extra form fields beyond GPS location (+ optional destination)
  needFields: GigFormField[];
  offerFields: GigFormField[];

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

// ─── Vertical Definitions ───────────────────────────────────────

export const VERTICALS: Record<GigVertical, VerticalConfig> = {
  rides: {
    id: 'rides',
    name: 'Rides',
    color: '#4285F4',
    needLabel: 'I need a Ride',
    needDesc: 'Request a ride in your area',
    offerLabel: 'I offer Rides',
    offerDesc: 'Drive people in your area',
    hasDestination: true,
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
    needLabel: 'I need a Delivery',
    needDesc: 'Get something picked up & delivered',
    offerLabel: 'I deliver',
    offerDesc: 'Deliver items in your area',
    hasDestination: true,
    needFields: [
      { key: 'item', label: 'Item Description', type: 'text', placeholder: 'What needs to be delivered?', required: true },
    ],
    offerFields: [],
    requesterNoun: 'customer',
    providerNoun: 'courier',
    requestNoun: 'delivery',
    matchTitle: 'Delivery Matched!',
    matchMessage: 'A courier has been matched to your delivery.',
    mapColor: '#FF6D00',
    mapDestColor: '#34A853',
    mapLabel: 'Delivery',
  },

  stays: {
    id: 'stays',
    name: 'Stays',
    color: '#E91E63',
    needLabel: 'I need a Place',
    needDesc: 'Find a place to stay nearby',
    offerLabel: 'I host a Place',
    offerDesc: 'Offer your space to guests',
    hasDestination: false,
    needFields: [
      { key: 'guests', label: 'Guests', type: 'text', placeholder: 'Number of guests', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any preferences or requirements...', required: false },
    ],
    offerFields: [
      { key: 'capacity', label: 'Capacity', type: 'text', placeholder: 'Max number of guests', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe your space...', required: true },
    ],
    requesterNoun: 'guest',
    providerNoun: 'host',
    requestNoun: 'stay',
    matchTitle: 'Stay Matched!',
    matchMessage: 'You have been connected with a host.',
    mapColor: '#E91E63',
    mapDestColor: '#E91E63',
    mapLabel: 'Stay',
  },

  services: {
    id: 'services',
    name: 'Services',
    color: '#00BCD4',
    needLabel: 'I need a Service',
    needDesc: 'Find someone to help with a task',
    offerLabel: 'I offer Services',
    offerDesc: 'Offer your skills nearby',
    hasDestination: false,
    needFields: [
      { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Plumbing, Tutoring, Design...', required: true },
      { key: 'description', label: 'What you need', type: 'textarea', placeholder: 'Describe the task...', required: true },
    ],
    offerFields: [
      { key: 'category', label: 'Specialty', type: 'text', placeholder: 'e.g. Plumbing, Tutoring, Design...', required: true },
      { key: 'description', label: 'About', type: 'textarea', placeholder: 'Describe what you offer...', required: true },
    ],
    requesterNoun: 'client',
    providerNoun: 'freelancer',
    requestNoun: 'service request',
    matchTitle: 'Service Matched!',
    matchMessage: 'You have been matched with a provider.',
    mapColor: '#00BCD4',
    mapDestColor: '#00BCD4',
    mapLabel: 'Service',
  },

  social: {
    id: 'social',
    name: 'Meet',
    color: '#FF4081',
    needLabel: 'I want to Meet',
    needDesc: 'Find people to connect with nearby',
    offerLabel: "I'm open to Meet",
    offerDesc: 'Let others know you want to connect',
    hasDestination: false,
    needFields: [
      { key: 'interests', label: 'Interests', type: 'text', placeholder: 'e.g. Coffee, Hiking, Tech...', required: false },
      { key: 'bio', label: 'About you', type: 'textarea', placeholder: 'A short intro...', required: false },
    ],
    offerFields: [
      { key: 'interests', label: 'Interests', type: 'text', placeholder: 'e.g. Coffee, Hiking, Tech...', required: false },
      { key: 'bio', label: 'About you', type: 'textarea', placeholder: 'A short intro...', required: false },
    ],
    requesterNoun: 'person',
    providerNoun: 'person',
    requestNoun: 'meetup',
    matchTitle: "It's a Match!",
    matchMessage: 'You have been connected with someone nearby.',
    mapColor: '#FF4081',
    mapDestColor: '#FF4081',
    mapLabel: 'Meet',
  },
};

/** Ordered list of verticals for the selector UI. */
export const VERTICAL_LIST: GigVertical[] = ['rides', 'delivery', 'stays', 'services', 'social'];
