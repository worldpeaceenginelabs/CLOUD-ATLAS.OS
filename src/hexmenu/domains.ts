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
// The LIVE mode is not a second data model — it's a fixed binding to
// domain='move', model='ridehailing' (see that model's comment). A
// model may be `internalOnly` (reachable only through a mode other
// than the normal DOMAIN→MODEL hex path) and/or carry
// `detailsByAction` (when its Details schema genuinely differs
// between 'offer' and 'search' — today only ridehailing).
//
// Location.svelte keeps its own Globe-/Location-API runtime binding —
// that's fachliche Laufzeit-Logik of the Location domain, not
// configuration, so it deliberately stays out of this file.

// ─── Shared field-shape types (unchanged from formSchema.ts) ───
// modeSelector: true | undefined
// title:        { label, placeholder } | undefined
// category:     { options, multi } | undefined
// date:         { label, required } | undefined
// description:  { placeholder } | undefined
// contact:      { hint } | undefined
// Everything present is required, EXCEPT date (only required when
// date.required === true) and modeSelector (never blocks readiness).

export type GeometryType = 'point' | 'route';

export interface LocationConfig {
  geometry: GeometryType;
}

export interface CategoryOption {
  id: string;
  name: string;
  description?: string;
}

export interface DetailsConfig {
  modeSelector?: true;
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
  details: DetailsConfig;
  // Set on models that exist in the domain/model table but are reached
  // through a different mode than the normal DOMAIN → MODEL selector —
  // today only 'ridehailing' (reached via the LIVE mode's fixed
  // domain=move/model=ridehailing binding, not picked from a hex row).
  // HexMenu filters these out when building the Listings model row, so
  // they never appear as a selectable hexagon there.
  internalOnly?: true;
  // Only needed when a model's Details schema genuinely differs
  // between the two actions (today only 'ridehailing': the cargo
  // category is single-select + has a description field on `search`,
  // multi-select with no description on `offer`). When absent, the
  // `details` above applies to both actions unchanged. `details` still
  // must be set even when this is present — it's the fallback/default.
  detailsByAction?: { offer: DetailsConfig; search: DetailsConfig };
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
      // erreichbar über den LIVE-Mode statt über den DOMAIN→MODEL-Hex-
      // Pfad (siehe `internalOnly`). HexMenu bindet mode=live intern
      // fest auf domain=move / model=ridehailing; die sichtbaren LIVE-
      // Labels ("I NEED A RIDE" / "I OFFER A RIDE") sind reine UI-
      // Navigation und leben in HexMenu.svelte, nicht hier.
      //
      // `details` unten ist die 'search'-Variante (== need_ride) als
      // Default; `detailsByAction` überschreibt sie pro Action, weil
      // sich das Schema hier tatsächlich fachlich unterscheidet (bei
      // keinem anderen Model nötig). Open question carried over from
      // formSchema.ts: 'search' conceptually needs *two* points
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
          category: { options: RIDE_CARGO_CATEGORIES, multi: false },
          description: { placeholder: 'Anything the driver should know — pickup details, luggage, timing, etc.' },
        },
        detailsByAction: {
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
          modeSelector: true,
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
          modeSelector: true,
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
          modeSelector: true,
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
          modeSelector: true,
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
          modeSelector: true,
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