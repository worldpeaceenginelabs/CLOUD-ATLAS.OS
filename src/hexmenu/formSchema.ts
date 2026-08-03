// ─── FORM SCHEMA ───
// One entry per model id (matching DOMAINS[].models[].id in HexMenu.svelte)
// for the 'listings' path, plus two entries ('need_ride' / 'offer_ride')
// for the 'live' path, keyed by selRide instead of a model id — same
// object, same lookup mechanism, no second schema table needed.
//
// This *is* Details.svelte's props — Details itself contains no
// per-domain branching, it only asks "is this field group present on
// my schema?" and renders accordingly. Every field group (title,
// category, date, description, contact) is optional and independent:
// a model that doesn't have it just omits the key, nothing renders,
// and it's automatically excluded from what's required (see
// detailsDone in HexMenu.svelte). This is what makes the 'live' forms
// possible without a parallel code path — need_ride/offer_ride simply
// have a smaller, different subset of the same field vocabulary.
//
// Deliberately NOT in here (by agreement, see anypay-concept discussion):
//   - formTitle / formSubtitle — dropped, the hex-menu tooltip already
//     covers "what is this" before the user ever opens Details.
//   - location — its own hex/flow, built separately. The 'live' forms'
//     pickupLocation / dropoffLocation / currentLocation therefore
//     aren't here either — they belong to that LOCATION flow once it
//     exists, not inside Details.
//   - submitLabel — Details has no submit button; SUBMIT/SEARCH live on
//     their own hex in the menu.
//
// Field shapes:
//   modeSelector: true | undefined
//   title:       { label, placeholder } | undefined
//   category:    { options, multi } | undefined
//   date:        { label, required } | undefined
//   description: { placeholder } | undefined
//   contact:     { hint } | undefined
// Everything present is required, EXCEPT date (only required when
// date.required === true) and modeSelector (never blocks readiness —
// it always has a sensible default, In-Person).

// ─── Category lists ───
// Shared lists carry a `description` per option (sourced from
// verticals.ts: HELPOUT_CATEGORIES, SOCIAL_CATEGORIES). Lists with no
// verticals.ts equivalent (Move, Goods, Food, Stay, Social Time,
// Production) have none yet — see the schema-table doc for that gap.

const MOVE_VEHICLE_CATEGORIES = [
  { id: 'bicycles-ebikes', name: 'Bicycles & E-Bikes' },
  { id: 'motorcycles-scooters', name: 'Motorcycles & Scooters' },
  { id: 'cars', name: 'Cars' },
  { id: 'boats-watercraft', name: 'Boats & Watercraft' },
  { id: 'campers-rvs', name: 'Campers & RVs' },
  { id: 'other-vehicles', name: 'Other Vehicles' },
];

const ROUTE_SHARING_CATEGORIES = [
  { id: 'passenger-seats', name: 'Passenger Seat(s)' },
  { id: 'small-package', name: 'Small Package' },
  { id: 'medium-item', name: 'Medium Item' },
  { id: 'large-cargo', name: 'Large Cargo' },
  { id: 'pet-transport', name: 'Pet Transport' },
  { id: 'other-cargo', name: 'Other' },
];

const GOODS_CATEGORIES = [
  { id: 'tools-equipment', name: 'Tools & Equipment' },
  { id: 'outdoor-camping-gear', name: 'Outdoor & Camping Gear' },
  { id: 'storage-garage-space', name: 'Storage & Garage Space' },
  { id: 'land-garden-space', name: 'Land & Garden Space' },
  { id: 'workshops-workbenches', name: 'Workshops & Workbenches' },
  { id: 'other-goods', name: 'Other Goods' },
];

const FOOD_PRODUCTION_CATEGORIES = [
  { id: 'home-cooked-meals', name: 'Home-Cooked Meals' },
  { id: 'baked-goods', name: 'Baked Goods' },
  { id: 'dairy-fermented-foods', name: 'Dairy & Fermented Foods' },
  { id: 'garden-produce', name: 'Garden Produce' },
  { id: 'community-kitchen', name: 'Community Kitchen' },
  { id: 'other-homemade-food', name: 'Other Homemade Food' },
];

const MEAL_SHARING_CATEGORIES = [
  { id: 'dinners-potlucks', name: 'Dinners & Potlucks' },
  { id: 'bbqs-cookouts', name: 'BBQs & Cookouts' },
  { id: 'community-meals', name: 'Community Meals' },
  { id: 'cooking-together', name: 'Cooking Together' },
  { id: 'other-meal-gatherings', name: 'Other Meal Gatherings' },
];

const FOOD_EXCHANGE_CATEGORIES = [
  { id: 'surplus-food', name: 'Surplus Food' },
  { id: 'garden-produce', name: 'Garden Produce' },
  { id: 'home-cooked-meals', name: 'Home-Cooked Meals' },
  { id: 'pantry-dry-goods', name: 'Pantry & Dry Goods' },
  { id: 'other-food-items', name: 'Other Food Items' },
];

const FOOD_RESCUE_CATEGORIES = [
  { id: 'household-surplus', name: 'Household Surplus' },
  { id: 'restaurant-cafe-surplus', name: 'Restaurant & Café Surplus' },
  { id: 'grocery-market-surplus', name: 'Grocery & Market Surplus' },
  { id: 'bakery-surplus', name: 'Bakery Surplus' },
  { id: 'other-rescued-food', name: 'Other Rescued Food' },
];

// Shared by Freelance Work, Skill Pooling, Helpout — verbatim from
// verticals.ts HELPOUT_CATEGORIES (ids included).
const HELPOUT_CATEGORIES = [
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

// Production has its own list in the schema table — NOT the same as
// HELPOUT_CATEGORIES, and has no verticals.ts source, so no descriptions.
const PRODUCTION_CATEGORIES = [
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

const STAY_EXCHANGE_CATEGORIES = [
  { id: 'couchsurfing-free-stay', name: 'Couchsurfing / Free Stay' },
  { id: 'home-exchange', name: 'Home Exchange' },
  { id: 'spare-room', name: 'Spare Room' },
  { id: 'other-accommodation', name: 'Other Accommodation' },
];

const STAY_POOLING_CATEGORIES = [
  { id: 'hotel-room', name: 'Hotel Room' },
  { id: 'airbnb-vacation-rental', name: 'Airbnb / Vacation Rental' },
  { id: 'long-term-apartment', name: 'Long-Term Apartment' },
  { id: 'coliving-nomad-space', name: 'Co-living / Nomad Space' },
  { id: 'other-pooled-stay', name: 'Other Pooled Stay' },
];

// Verbatim from verticals.ts SOCIAL_CATEGORIES (ids included).
const SOCIAL_CATEGORIES = [
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

const SOCIAL_TIME_CATEGORIES = [
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
const RIDE_CARGO_CATEGORIES = [
  { id: 'person', name: 'Person' },
  { id: 'package', name: 'Package' },
  { id: 'animal', name: 'Animal' },
  { id: 'other', name: 'Other' },
];

// ─── Schema, keyed by model id (listings path) or by selRide (live path) ───
export const FORM_SCHEMA = {
  vehicle_exchange: {
    title: { label: 'Vehicle Title', placeholder: 'e.g. Mountain Bike, Family Car, Fishing Boat...' },
    category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
    description: { placeholder: "Describe the vehicle and how you'd like to share or swap it..." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  p2p_vehicle_rental: {
    title: { label: 'Vehicle Title', placeholder: 'e.g. Scooter for Rent, Weekend Camper...' },
    category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
    description: { placeholder: 'Describe the vehicle, availability, and rental terms...' },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  // Covers both classic P2P vehicle rides-for-hire AND casual route
  // sharing ("I'm heading that way anyway") — Vehicle Ride Sharing was
  // merged into this model, it no longer exists as its own hexagon.
  route_sharing: {
    title: { label: 'Trip Title', placeholder: 'e.g. Cebu → Manila, Tomorrow 8 AM...' },
    category: { options: ROUTE_SHARING_CATEGORIES, multi: true },
    date: { label: 'Departure', required: true },
    description: { placeholder: 'Anything riders or senders should know — luggage space, recurring trips, pets, pickup flexibility, etc.' },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  goods_sharing: {
    title: { label: 'Item Title', placeholder: 'e.g. Power Drill, Camping Tent, Garden Plot...' },
    category: { options: GOODS_CATEGORIES, multi: false },
    description: { placeholder: "Describe the item and how you'd like to share, lend, or swap it..." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  food_production: {
    title: { label: 'Title', placeholder: 'e.g. Sourdough Bread, Weekly Meal Boxes...' },
    category: { options: FOOD_PRODUCTION_CATEGORIES, multi: false },
    description: { placeholder: 'What are you making, and how can people get it?' },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  meal_sharing: {
    title: { label: 'Meal Title', placeholder: 'e.g. Sunday Dinner, Neighborhood BBQ...' },
    category: { options: MEAL_SHARING_CATEGORIES, multi: false },
    date: { label: 'Date & Time', required: false },
    description: { placeholder: "What's on the menu? Tell people about the meal and the gathering." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  food_exchange: {
    title: { label: 'Title', placeholder: 'e.g. Extra Tomatoes, Leftover Bread...' },
    category: { options: FOOD_EXCHANGE_CATEGORIES, multi: false },
    description: { placeholder: 'What do you have available, and what (if anything) would you like in return?' },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  food_rescue: {
    title: { label: 'Title', placeholder: 'e.g. End-of-Day Bakery Surplus, Grocery Overstock...' },
    category: { options: FOOD_RESCUE_CATEGORIES, multi: false },
    description: { placeholder: "What's available, how much is there, and when should it be collected?" },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  freelance_work: {
    modeSelector: true,
    title: { label: 'Title', placeholder: 'e.g. Logo Design, Web Development...' },
    category: { options: HELPOUT_CATEGORIES, multi: false },
    description: { placeholder: "What can you offer, and what's your experience?" },
    contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
  },
  production: {
    modeSelector: true,
    title: { label: 'Title', placeholder: 'e.g. Custom Furniture, 3D-Printed Parts...' },
    category: { options: PRODUCTION_CATEGORIES, multi: false },
    description: { placeholder: 'What can you make, and what do you need from the other person to get started?' },
    contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
  },
  skill_pooling: {
    modeSelector: true,
    title: { label: 'Project Title', placeholder: 'e.g. Open Source App...' },
    category: { options: HELPOUT_CATEGORIES, multi: false },
    description: { placeholder: "What's the project, and what skills are you looking to combine?" },
    contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
  },
  helpout: {
    modeSelector: true,
    title: { label: 'Title', placeholder: 'e.g. Help Installing Shelves, Need Gardening Help...' },
    category: { options: HELPOUT_CATEGORIES, multi: false },
    description: { placeholder: 'What do you need help with, or what would you like to help others with?' },
    contact: { hint: 'Telegram, WhatsApp, Signal, Zoom, or any link' },
  },
  stay_exchange: {
    title: { label: 'Title', placeholder: 'e.g. Guest Room in Cebu...' },
    category: { options: STAY_EXCHANGE_CATEGORIES, multi: false },
    description: { placeholder: "Describe the space and the kind of exchange or stay you're offering." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  stay_pooling: {
    title: { label: 'Title', placeholder: 'e.g. Airbnb in Bali...' },
    category: { options: STAY_POOLING_CATEGORIES, multi: false },
    description: { placeholder: 'Describe the accommodation and how the costs will be shared.' },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  social_activity_sharing: {
    modeSelector: true,
    title: { label: 'Event Title', placeholder: 'e.g. Saturday Morning Run, Board Game Night...' },
    category: { options: SOCIAL_CATEGORIES, multi: false },
    date: { label: 'Date & Time', required: false },
    description: { placeholder: "What's the plan? Tell people about the activity." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },
  social_time: {
    title: { label: 'Project Title', placeholder: 'e.g. Beach Clean-Up...' },
    category: { options: SOCIAL_TIME_CATEGORIES, multi: false },
    date: { label: 'Date & Time', required: false },
    description: { placeholder: "What's the project about, and how can people help? Mention any useful skills if applicable—but everyone can decide for themselves whether they're a good fit." },
    contact: { hint: 'Telegram, WhatsApp, Signal, or any link' },
  },

  // ─── 'live' path — keyed by selRide, not a model id ───
  // Minimal transport-matching core. pickupLocation / dropoffLocation /
  // currentLocation are NOT here — they're LOCATION's job. The one open
  // question worth a second look once LOCATION is built: 'need_ride'
  // conceptually needs *two* points (pickup + drop-off), but the
  // LOCATION hex as designed only carries one. Simplest resolution
  // path: LOCATION supplies pickupLocation, and dropoffLocation moves
  // into this schema as a second location-search field once that
  // component exists — flagging it here rather than guessing now.
  need_ride: {
    category: { options: RIDE_CARGO_CATEGORIES, multi: false },
    description: { placeholder: 'Anything the driver should know — pickup details, luggage, timing, etc.' },
  },
  offer_ride: {
    category: { options: RIDE_CARGO_CATEGORIES, multi: true },
  },
};