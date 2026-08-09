// domains.ts
//
// ─── SINGLE SOURCE OF TRUTH for every domain / model in the hex menu ───
//
// Previously, one model's config was split across three places:
//   - HexMenu.svelte's DOMAINS table   (id, label, anypay, description, examples)
//   - locationschema.ts's LOCATION_SCHEMA (geometry — keyed separately by model id)
//   - formSchema.ts's FORM_SCHEMA        (Details field spec — keyed separately by model id)
// The only thing tying these three together was the model id string
// matching across all three tables by convention, not by structure.
//
// Now every model carries its own complete config (anypay relations,
// location geometry, Details field spec) as one object. HexMenu.svelte
// no longer contains any model-specific data — it only reads this file,
// manages state, and coordinates the Location/Details/AnyPay components.
//
// There is exactly one MODE/ACTION/DOMAIN/MODEL table: DOMAINS below.
// A model may be `internalOnly` (reachable only through a shortcut mode
// rather than the normal DOMAIN→MODEL hex path — see SHORTCUT_MODES)
// and/or declare its `details` per-action (when its Details schema
// genuinely differs between 'offer' and 'search' — today only
// ridehailing); resolve it via detailsFor(), never by reading
// `.details` directly.
//
// Everything HexMenu.svelte needs to label and route its own hexagons —
// header modes, shortcut-mode buttons, listings actions, form-step
// labels, and the placeholder 'next' mode's content — is declared
// below in ─── MENU STRUCTURE ───, so a different app only has to
// redefine this file; HexMenu.svelte carries no app-specific strings.
// The one exception is the ambient flavor text shown in HexMenu's
// background, which lives in hexMessages.ts (unrelated to the domain
// model, so kept separate rather than crammed in here).
//
// isDetailsComplete()/isLocationComplete() mirror detailsFor(): they
// centralize interpreting a schema's shape so HexMenu never needs to
// know DetailsConfig/LocationConfig's field vocabulary itself.
//
// Location.svelte keeps its own Globe-/Location-API runtime binding —
// that's fachliche Laufzeit-Logik of the Location domain, not
// configuration, so it deliberately stays out of this file.

// ─── Shared field-shape types (unchanged from formSchema.ts) ───
// interactionMode: true | undefined
// title:        { label, placeholder } | undefined
// category:     { options, multi } | undefined
// date:         { label, required } | undefined
// description:  { placeholder } | undefined
// contact:      { hint } | undefined
// Everything present is required, EXCEPT date (only required when
// date.required === true) and interactionMode (never blocks readiness).

export type GeometryType = 'point' | 'route';

export interface LocationConfig {
  geometry: GeometryType;
}

// The confirmed value HexMenu stores in selLocation and passes to
// isLocationComplete() — declared once here so HexMenu.svelte doesn't
// need its own copy of this union.
export type LocationValue =
  | { geometry: 'point'; point: { latitude: number; longitude: number } }
  | { geometry: 'route'; from: { latitude: number; longitude: number }; to: { latitude: number; longitude: number } };

export interface CategoryOption {
  id: string;
  name: string;
  description?: string;
}

export interface DetailsConfig {
  // Whether this model's form should include the in-person/online/both
  // selector (Details.svelte). Named `interactionMode` — not `mode` —
  // to avoid colliding with the app-level MODE concept (live/listings,
  // see HexMenu.svelte's selMode); this is an unrelated per-model field.
  interactionMode?: true;
  title?: { label: string; placeholder: string };
  category?: { options: CategoryOption[]; multi: boolean };
  date?: { label?: string; required: boolean };
  description?: { placeholder: string };
  contact?: { hint: string };
}

export interface ModelConfig {
  id: string;
  label: string;
  description: string;
  examples: string;
  anypay: string[]; // ANYPAY_OPTIONS[].id this model allows
  location: LocationConfig;
  // Details field spec. Either one DetailsConfig shared by both actions
  // (the normal case — every model except ridehailing), or one
  // DetailsConfig per action, for the rare case where the Details
  // schema genuinely differs between 'offer' and 'search' (today only
  // ridehailing: cargo category is single-select + has a description
  // field on 'search', multi-select with no description on 'offer').
  // Resolve with detailsFor() below rather than reading this directly —
  // it's the one place that knows how to pick between the two shapes.
  details: DetailsConfig | { offer: DetailsConfig; search: DetailsConfig };
  // Set on models that exist in the domain/model table but are reached
  // through a different mode than the normal DOMAIN → MODEL selector —
  // today only 'ridehailing' (reached via the LIVE mode's fixed
  // domain=move/model=ridehailing binding, not picked from a hex row).
  // HexMenu filters these out when building the Listings model row, so
  // they never appear as a selectable hexagon there.
  internalOnly?: true;
}

// Resolves a model's Details schema for the action currently in effect.
// Centralized here so callers (HexMenu.svelte) never need to know
// whether a given model varies its Details schema by action — they
// just ask for "the schema for this model + this action".
export function detailsFor(model: ModelConfig, action: 'offer' | 'search' | null): DetailsConfig {
  const spec = model.details;
  if ('offer' in spec && 'search' in spec) {
    return action === 'offer' ? spec.offer : spec.search;
  }
  return spec;
}

// Whether a Details form is filled in enough to submit. Same idea as
// detailsFor(): the field vocabulary (title/category/date/description/
// contact) is interpreted once, here, rather than in HexMenu.svelte —
// interactionMode is intentionally excluded, it never blocks readiness.
export function isDetailsComplete(schema: DetailsConfig | null, values: Record<string, any>): boolean {
  if (!schema) return true;
  return (
    (!schema.title || !!values.title) &&
    (!schema.description || !!values.description) &&
    (!schema.contact || !!values.contact) &&
    (!schema.category || (schema.category.multi
      ? (values.categoryIds || []).length > 0
      : !!values.categoryId)) &&
    (!schema.date || !schema.date.required || !!values.date)
  );
}

// Whether a Location value satisfies its schema's geometry.
export function isLocationComplete(schema: LocationConfig | null, value: LocationValue | null): boolean {
  if (!schema) return true;
  return schema.geometry === 'point'
    ? !!value?.point
    : !!(value?.from && value?.to);
}

export interface DomainConfig {
  id: string;
  label: string;
  models: ModelConfig[];
}

// ─── ANYPAY: 5 fixed payment modes, referenced by id from each model ───
export const ANYPAY_OPTIONS = [
  { id: 'money',      label: 'Money' },
  { id: 'share',      label: 'Share' },
  { id: 'zerodollar', label: 'ZeroDollar' },
  { id: 'swap',       label: 'Swap' },
  { id: 'free',       label: 'Free' },
];

// ─── Category lists ───
// Shared lists carry a `description` per option (sourced from
// verticals.ts: HELPOUT_CATEGORIES, SOCIAL_CATEGORIES). Lists with no
// verticals.ts equivalent (Move, Goods, Food, Stay, Social Time,
// Production) have none yet.

const MOVE_VEHICLE_CATEGORIES: CategoryOption[] = [
  { id: 'bicycles-ebikes', name: 'Bicycles & E-Bikes' },
  { id: 'motorcycles-scooters', name: 'Motorcycles & Scooters' },
  { id: 'cars', name: 'Cars' },
  { id: 'boats-watercraft', name: 'Boats & Watercraft' },
  { id: 'campers-rvs', name: 'Campers & RVs' },
  { id: 'other-vehicles', name: 'Other Vehicles' },
];

const ROUTE_SHARING_CATEGORIES: CategoryOption[] = [
  { id: 'passenger-seats', name: 'Passenger Seat(s)' },
  { id: 'small-package', name: 'Small Package' },
  { id: 'medium-item', name: 'Medium Item' },
  { id: 'large-cargo', name: 'Large Cargo' },
  { id: 'pet-transport', name: 'Pet Transport' },
  { id: 'other-cargo', name: 'Other' },
];

const GOODS_CATEGORIES: CategoryOption[] = [
  { id: 'tools-equipment', name: 'Tools & Equipment' },
  { id: 'outdoor-camping-gear', name: 'Outdoor & Camping Gear' },
  { id: 'storage-garage-space', name: 'Storage & Garage Space' },
  { id: 'land-garden-space', name: 'Land & Garden Space' },
  { id: 'workshops-workbenches', name: 'Workshops & Workbenches' },
  { id: 'other-goods', name: 'Other Goods' },
];

const FOOD_PRODUCTION_CATEGORIES: CategoryOption[] = [
  { id: 'home-cooked-meals', name: 'Home-Cooked Meals' },
  { id: 'baked-goods', name: 'Baked Goods' },
  { id: 'dairy-fermented-foods', name: 'Dairy & Fermented Foods' },
  { id: 'garden-produce', name: 'Garden Produce' },
  { id: 'community-kitchen', name: 'Community Kitchen' },
  { id: 'other-homemade-food', name: 'Other Homemade Food' },
];

const MEAL_SHARING_CATEGORIES: CategoryOption[] = [
  { id: 'dinners-potlucks', name: 'Dinners & Potlucks' },
  { id: 'bbqs-cookouts', name: 'BBQs & Cookouts' },
  { id: 'community-meals', name: 'Community Meals' },
  { id: 'cooking-together', name: 'Cooking Together' },
  { id: 'other-meal-gatherings', name: 'Other Meal Gatherings' },
];

const FOOD_EXCHANGE_CATEGORIES: CategoryOption[] = [
  { id: 'surplus-food', name: 'Surplus Food' },
  { id: 'garden-produce', name: 'Garden Produce' },
  { id: 'home-cooked-meals', name: 'Home-Cooked Meals' },
  { id: 'pantry-dry-goods', name: 'Pantry & Dry Goods' },
  { id: 'other-food-items', name: 'Other Food Items' },
];

const FOOD_RESCUE_CATEGORIES: CategoryOption[] = [
  { id: 'household-surplus', name: 'Household Surplus' },
  { id: 'restaurant-cafe-surplus', name: 'Restaurant & Café Surplus' },
  { id: 'grocery-market-surplus', name: 'Grocery & Market Surplus' },
  { id: 'bakery-surplus', name: 'Bakery Surplus' },
  { id: 'other-rescued-food', name: 'Other Rescued Food' },
];

// Shared by Freelance Work, Skill Pooling, Helpout — verbatim from
// verticals.ts HELPOUT_CATEGORIES (ids included).
const HELPOUT_CATEGORIES: CategoryOption[] = [
  { id: 'art-music', name: 'Art & Music', description: 'Instruments, singing, painting, photography' },
  { id: 'cooking', name: 'Cooking & Nutrition', description: 'Recipes, dietary guidance, baking, special diets' },
  { id: 'computers', name: 'Computers & Electronics', description: 'Software, programming, web design, IT support' },
  { id: 'business', name: 'Business & Career', description: 'Career coaching, communication, planning, marketing' },
  { id: 'finance', name: 'Finance & Legal', description: 'Taxes, investment advice, basic legal guidance' },
  { id: 'health', name: 'Health & Fitness', description: 'Yoga, meditation, workouts, nutrition, coaching' },
  { id: 'languages', name: 'Languages & Learning', description: 'Language lessons, exam prep, learning strategies' },
  { id: 'lifestyle', name: 'Lifestyle & Hobbies', description: 'DIY, crafting, travel, fashion, pets, gardening' },
  { id: 'other', name: 'Other / Specialty Skills', description: "Everything else that doesn't fit standard categories" },
];

// Production has its own list — NOT the same as HELPOUT_CATEGORIES,
// and has no verticals.ts source, so no descriptions.
const PRODUCTION_CATEGORIES: CategoryOption[] = [
  { id: 'woodworking', name: 'Woodworking' },
  { id: 'metalworking', name: 'Metalworking' },
  { id: '3d-printing', name: '3D Printing' },
  { id: 'sewing-textiles', name: 'Sewing & Textiles' },
  { id: 'ceramics-pottery', name: 'Ceramics & Pottery' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'handmade-art', name: 'Handmade Art' },
  { id: 'food-production', name: 'Food Production' },
  { id: 'other-production', name: 'Other Production' },
];

const STAY_EXCHANGE_CATEGORIES: CategoryOption[] = [
  { id: 'couchsurfing-free-stay', name: 'Couchsurfing / Free Stay' },
  { id: 'home-exchange', name: 'Home Exchange' },
  { id: 'spare-room', name: 'Spare Room' },
  { id: 'other-accommodation', name: 'Other Accommodation' },
];

const STAY_POOLING_CATEGORIES: CategoryOption[] = [
  { id: 'hotel-room', name: 'Hotel Room' },
  { id: 'airbnb-vacation-rental', name: 'Airbnb / Vacation Rental' },
  { id: 'long-term-apartment', name: 'Long-Term Apartment' },
  { id: 'coliving-nomad-space', name: 'Co-living / Nomad Space' },
  { id: 'other-pooled-stay', name: 'Other Pooled Stay' },
];

// Verbatim from verticals.ts SOCIAL_CATEGORIES (ids included).
const SOCIAL_CATEGORIES: CategoryOption[] = [
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

const SOCIAL_TIME_CATEGORIES: CategoryOption[] = [
  { id: 'animal-shelter-rescue', name: 'Animal Shelter & Rescue' },
  { id: 'environmental-action', name: 'Environmental Action' },
  { id: 'reforestation-planting', name: 'Reforestation & Planting' },
  { id: 'community-garden', name: 'Community Garden' },
  { id: 'community-health', name: 'Community Health' },
  { id: 'education-tutoring', name: 'Education & Tutoring' },
  { id: 'repair-fixit-days', name: 'Repair & Fix-It Days' },
  { id: 'other-community-projects', name: 'Other Community Projects' },
];

// "What's being transported" — the minimal category vocabulary for the
// 'live' ride-matching flow (need_ride / offer_ride). No verticals.ts
// source, defined fresh from the transport-matching spec.
const RIDE_CARGO_CATEGORIES: CategoryOption[] = [
  { id: 'person', name: 'Person' },
  { id: 'package', name: 'Package' },
  { id: 'animal', name: 'Animal' },
  { id: 'other', name: 'Other' },
];

// ─── DOMAIN / MODEL TABLE ───
// This *is* the menu, from Row 2 down: one entry per domain, each with
// its own model list (length varies — 1 to 4). A domain with <= 1
// model has no model-selection row at all; the form appears right
// after the domain is picked, using that single model as the
// "effective model". A model with an empty anypay[] (only Social,
// today) makes the ANYPAY hex disappear from the form entirely — no
// special-casing needed, it all falls out of this one table.
export const DOMAINS: DomainConfig[] = [
  {
    id: 'move', label: 'MOVE',
    models: [
      {
        id: 'vehicle_exchange', label: 'Vehicle Exchange', anypay: ['share', 'swap'],
        description: 'Share or swap existing vehicles between people.',
        examples: 'Bikes, motorcycles, cars, boats, campers used jointly.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Vehicle Title', placeholder: 'e.g. Mountain Bike, Family Car, Fishing Boat...' },
          category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
          description: { placeholder: "Describe the vehicle and how you'd like to share or swap it..." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      {
        id: 'p2p_vehicle_rental', label: 'P2P Vehicle Rental', anypay: ['money', 'zerodollar'],
        description: 'Private individuals make vehicles temporarily available to others.',
        examples: 'Renting out a private car, motorcycle, or camper.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Vehicle Title', placeholder: 'e.g. Scooter for Rent, Weekend Camper...' },
          category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
          description: { placeholder: 'Describe the vehicle, availability, and rental terms...' },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      // Covers both classic P2P vehicle rides-for-hire AND casual route
      // sharing ("I'm heading that way anyway") — Vehicle Ride Sharing
      // was merged into this model, it no longer exists as its own
      // hexagon.
      {
        id: 'route_sharing', label: 'Route Sharing', anypay: ['free', 'share', 'zerodollar'],
        description: 'People use trips they were already making to carry extra people or goods.',
        examples: '"I\'m heading to Berlin anyway, I can take your package."',
        location: { geometry: 'route' },
        details: {
          title: { label: 'Trip Title', placeholder: 'e.g. Cebu → Manila, Tomorrow 8 AM...' },
          category: { options: ROUTE_SHARING_CATEGORIES, multi: true },
          date: { label: 'Departure', required: true },
          description: { placeholder: 'Anything riders or senders should know — luggage space, recurring trips, pets, pickup flexibility, etc.' },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      // Fachlich Teil von MOVE, wie jedes andere Model hier — nur
      // erreichbar über einen Shortcut-Mode statt über den DOMAIN→
      // MODEL-Hex-Pfad (siehe `internalOnly`). Welcher Mode hierher
      // bindet und wie seine Buttons heißen ("I NEED A RIDE" / "I
      // OFFER A RIDE") steht in SHORTCUT_MODES weiter unten — auch das
      // ist fachliche Konfiguration, nicht HexMenu-Wissen.
      //
      // `details` ist hier die einzige Stelle im ganzen Table, wo sich
      // das Schema tatsächlich fachlich zwischen den Actions
      // unterscheidet — daher die Pro-Action-Form statt eines einzelnen
      // DetailsConfig; siehe detailsFor(). Open question carried over
      // from formSchema.ts: 'search' conceptually needs *two* points
      // (pickup + drop-off), but LOCATION as designed only carries
      // one — worth a second look once that becomes relevant.
      {
        id: 'ridehailing', label: 'Ridehailing',
        anypay: ANYPAY_OPTIONS.map(o => o.id), // live path leaves all 5 open
        description: 'Real-time matching between someone who needs a ride and someone driving right now.',
        examples: 'Person or package pickup, on-demand — no listing, no browsing.',
        internalOnly: true,
        location: { geometry: 'route' },
        details: {
          search: {
            category: { options: RIDE_CARGO_CATEGORIES, multi: false },
            description: { placeholder: 'Anything the driver should know — pickup details, luggage, timing, etc.' },
          },
          offer: {
            category: { options: RIDE_CARGO_CATEGORIES, multi: true },
          },
        },
      },
    ],
  },
  {
    id: 'goods', label: 'GOODS',
    models: [
      {
        id: 'goods_sharing', label: 'Goods Sharing', anypay: ['share', 'zerodollar', 'swap'],
        description: 'Shared use of existing items or spaces.',
        examples: 'Tools, tents, garages, workbenches, unused gardens, land.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Item Title', placeholder: 'e.g. Power Drill, Camping Tent, Garden Plot...' },
          category: { options: GOODS_CATEGORIES, multi: false },
          description: { placeholder: "Describe the item and how you'd like to share, lend, or swap it..." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
    ],
  },
  {
    id: 'food', label: 'FOOD',
    models: [
      {
        id: 'food_production', label: 'Food Production', anypay: ['money', 'share', 'zerodollar', 'swap'],
        description: 'People produce food or meals for others.',
        examples: 'Home cooking, bread, cheese, garden produce, community kitchens.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Title', placeholder: 'e.g. Sourdough Bread, Weekly Meal Boxes...' },
          category: { options: FOOD_PRODUCTION_CATEGORIES, multi: false },
          description: { placeholder: 'What are you making, and how can people get it?' },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      {
        id: 'meal_sharing', label: 'Meal Sharing', anypay: ['share', 'zerodollar', 'swap'],
        description: 'Cooking and eating together as a social activity.',
        examples: 'Dinners, cookouts, community meals.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Meal Title', placeholder: 'e.g. Sunday Dinner, Neighborhood BBQ...' },
          category: { options: MEAL_SHARING_CATEGORIES, multi: false },
          date: { label: 'Date & Time', required: false },
          description: { placeholder: "What's on the menu? Tell people about the meal and the gathering." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      {
        id: 'food_exchange', label: 'Food Exchange', anypay: ['share', 'zerodollar', 'swap', 'free'],
        description: 'Share existing food or meals.',
        examples: 'Surplus food, garden produce, home-cooked meals.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Title', placeholder: 'e.g. Extra Tomatoes, Leftover Bread...' },
          category: { options: FOOD_EXCHANGE_CATEGORIES, multi: false },
          description: { placeholder: 'What do you have available, and what (if anything) would you like in return?' },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      {
        id: 'food_rescue', label: 'Food Rescue', anypay: ['swap', 'free'],
        description: 'Rescue food from being wasted.',
        examples: 'Surplus food from households or businesses.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Title', placeholder: 'e.g. End-of-Day Bakery Surplus, Grocery Overstock...' },
          category: { options: FOOD_RESCUE_CATEGORIES, multi: false },
          description: { placeholder: "What's available, how much is there, and when should it be collected?" },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
    ],
  },
  {
    id: 'skills', label: 'SKILLS',
    models: [
      {
        id: 'freelance_work', label: 'Freelance Work', anypay: ['money', 'share', 'zerodollar', 'swap'],
        description: 'Offer individual skills as a service.',
        examples: 'Programming, design, consulting, repairs.',
        location: { geometry: 'point' },
        details: {
          interactionMode: true,
          title: { label: 'Title', placeholder: 'e.g. Logo Design, Web Development...' },
          category: { options: HELPOUT_CATEGORIES, multi: false },
          description: { placeholder: "What can you offer, and what's your experience?" },
          contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
        },
      },
      {
        id: 'production', label: 'Production', anypay: ['money', 'share', 'zerodollar', 'swap'],
        description: 'Direct production of physical goods between people.',
        examples: 'Carpentry, 3D printing, furniture making, craftwork.',
        location: { geometry: 'point' },
        details: {
          interactionMode: true,
          title: { label: 'Title', placeholder: 'e.g. Custom Furniture, 3D-Printed Parts...' },
          category: { options: PRODUCTION_CATEGORIES, multi: false },
          description: { placeholder: 'What can you make, and what do you need from the other person to get started?' },
          contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
        },
      },
      {
        id: 'skill_pooling', label: 'Skill Pooling', anypay: ['money', 'share', 'zerodollar', 'swap'],
        description: 'Pool several skills toward a shared goal.',
        examples: 'Open source, house building, community projects.',
        location: { geometry: 'point' },
        details: {
          interactionMode: true,
          title: { label: 'Project Title', placeholder: 'e.g. Open Source App...' },
          category: { options: HELPOUT_CATEGORIES, multi: false },
          description: { placeholder: "What's the project, and what skills are you looking to combine?" },
          contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
        },
      },
      {
        id: 'helpout', label: 'Helpout', anypay: ['share', 'zerodollar', 'swap'],
        description: 'Direct everyday support.',
        examples: 'Moving help, errands, neighborly assistance.',
        location: { geometry: 'point' },
        details: {
          interactionMode: true,
          title: { label: 'Title', placeholder: 'e.g. Help Installing Shelves, Need Gardening Help...' },
          category: { options: HELPOUT_CATEGORIES, multi: false },
          description: { placeholder: 'What do you need help with, or what would you like to help others with?' },
          contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
        },
      },
    ],
  },
  {
    id: 'stay', label: 'STAY',
    models: [
      {
        id: 'stay_exchange', label: 'Stay Exchange', anypay: ['share', 'zerodollar', 'swap'],
        description: 'Share or swap existing accommodation.',
        examples: 'Couchsurfing, home exchange, spare rooms.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Title', placeholder: 'e.g. Guest Room in Cebu...' },
          category: { options: STAY_EXCHANGE_CATEGORIES, multi: false },
          description: { placeholder: "Describe the space and the kind of exchange or stay you're offering." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
      {
        id: 'stay_pooling', label: 'Stay Pooling', anypay: ['money'],
        description: 'Several people jointly fund a place to stay.',
        examples: 'Splitting a hotel room, Airbnb, vacation rental, nomad apartment.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Title', placeholder: 'e.g. Airbnb in Bali...' },
          category: { options: STAY_POOLING_CATEGORIES, multi: false },
          description: { placeholder: 'Describe the accommodation and how the costs will be shared.' },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
    ],
  },
  {
    id: 'social', label: 'SOCIAL',
    models: [
      {
        id: 'social_activity_sharing', label: 'Social Network / Activity Sharing', anypay: [],
        description: 'People create, discover, and join shared activities. Focus: meeting people, leisure, and social connection.',
        examples: 'Discover local activities, join interest-based groups, and connect with people for hiking, games, sports, dining, and spontaneous meetups.',
        location: { geometry: 'point' },
        details: {
          interactionMode: true,
          title: { label: 'Event Title', placeholder: 'e.g. Saturday Morning Run, Board Game Night...' },
          category: { options: SOCIAL_CATEGORIES, multi: false },
          date: { label: 'Date & Time', required: false },
          description: { placeholder: "What's the plan? Tell people about the activity." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
    ],
  },
  {
    id: 'social_time', label: 'SOCIAL\nTIME',
    models: [
      {
        id: 'social_time', label: 'Social Time', anypay: ['free', 'zerodollar'],
        description: 'People contribute time, experience, and voluntary work to community projects. Projects state their own requirements; people decide for themselves whether to join.',
        examples: 'Animal shelter help, environmental action, reforestation, community gardens, health drives, education projects, repair days.',
        location: { geometry: 'point' },
        details: {
          title: { label: 'Project Title', placeholder: 'e.g. Beach Clean-Up...' },
          category: { options: SOCIAL_TIME_CATEGORIES, multi: false },
          date: { label: 'Date & Time', required: false },
          description: { placeholder: "What's the project about, and how can people help? Mention any useful skills if applicable—but everyone can decide for themselves whether they're a good fit." },
          contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
        },
      },
    ],
  },
];

// ─── MENU STRUCTURE (mode / action / form-step vocabulary) ───
// Everything below is what makes HexMenu.svelte a generic engine: it
// labels and routes the component's own hexagons (header, shortcut
// buttons, listings actions, form steps), so none of this wording or
// ID vocabulary has to be hardcoded there. A different app wanting the
// same hex-menu engine redefines DOMAINS above plus this section —
// HexMenu.svelte itself stays untouched.

export interface ModeConfig {
  id: string;
  label: string;
  noop?: true; // inert placeholder hex (today: BBQ) — renders, does nothing on click
  // Exactly one MODES entry should set this: the mode that drives the
  // generic ACTION → DOMAIN → MODEL flow below (today: 'listings').
  // HexMenu checks this flag rather than any mode's id, so renaming or
  // replacing 'listings' in a different app needs no HexMenu.svelte edit.
  genericFlow?: true;
  // For a mode that's neither genericFlow nor a SHORTCUT_MODES entry —
  // a reserved placeholder with no flow wired up yet (today: 'next').
  // Its hexagons render at row 1 and go nowhere.
  placeholderNodes?: { id: string; label: string }[];
}

// Row 0 (header). 'listings' is the one mode that drives the generic
// ACTION → DOMAIN → MODEL flow below (see `genericFlow`); every other
// mode is either a SHORTCUT_MODES entry (bound to one fixed
// domain/model) or, like 'next', just shows its own placeholderNodes.
export const MODES: ModeConfig[] = [
  { id: 'live', label: 'LIVE' },
  { id: 'listings', label: 'LISTINGS', genericFlow: true },
  {
    id: 'next', label: 'NEXT',
    placeholderNodes: [
      { id: 'm1', label: 'MISSION 1\nTV' },
      { id: 'm2', label: 'MISSION 2\nGOV' },
      { id: 'm3', label: 'MISSION 3\nOMNI' },
      { id: 'm4', label: 'MISSION 4\nCONSERV' },
    ],
  },
  { id: 'bbq', label: 'BBQ', noop: true },
];

export interface ShortcutActionConfig {
  id: string;                  // hex id for this button
  label: string;
  action: 'offer' | 'search';  // must match one of ACTIONS[].id below
}

export interface ShortcutModeConfig {
  modeId: string;   // references MODES[].id
  domain: string;   // references DOMAINS[].id
  model: string;    // references a model id within that domain — normally `internalOnly`
  actions: ShortcutActionConfig[];
}

// A "shortcut mode" skips DOMAIN/MODEL selection entirely and binds
// straight onto one fixed model. Today's only one: LIVE → move →
// ridehailing (see that model's comment above). Its two buttons are
// UI navigation, but which action they mean and which domain/model
// they bind to is fachliche Konfiguration, so it lives here rather
// than as literals in HexMenu.svelte.
export const SHORTCUT_MODES: ShortcutModeConfig[] = [
  {
    modeId: 'live',
    domain: 'move',
    model: 'ridehailing',
    actions: [
      { id: 'need_ride', label: 'I NEED\nA RIDE', action: 'search' },
      { id: 'offer_ride', label: 'I OFFER\nA RIDE', action: 'offer' },
    ],
  },
];

export interface ActionConfig {
  id: 'offer' | 'search'; // the value stored as selAction; also the row-1 hex id under 'listings'
  label: string;          // row-1 hex label under 'listings'
  submitNodeId: string;   // hex id for the final form-row button
  submitLabel: string;    // its label
  submitEvent: string;    // event name HexMenu dispatches on submit
}

// The two actions shared by every mode — 'listings' shows them
// directly as its row-1 choice; SHORTCUT_MODES entries reference the
// same `action` values from their own buttons instead of showing this
// row (see shortcutNodes/actionNodes in HexMenu.svelte).
export const ACTIONS: ActionConfig[] = [
  { id: 'offer', label: 'OFFER', submitNodeId: 'submit', submitLabel: 'SUBMIT', submitEvent: 'offerSubmit' },
  { id: 'search', label: 'SEARCH', submitNodeId: 'gosearch', submitLabel: 'SEARCH', submitEvent: 'searchSubmit' },
];

// Labels for the three fixed form-row hexagons (LOCATION/DETAILS always
// shown when the form is; ANYPAY only when the effective model has
// anypay options — see HexMenu's showAnypayHex). Their ids stay literal
// in HexMenu.svelte since each is wired to one specific component
// (Location/Details/Anypay.svelte) — only the label text is data here,
// not the component wiring itself.
export const FORM_STEP_LABELS = {
  location: 'LOCATION',
  details: 'DETAILS',
  anypay: 'ANYPAY',
} as const;