// ─── FORM SCHEMA ───
// One entry per model id (matching DOMAINS[].models[].id in HexMenu.svelte).
// This *is* Details.svelte's props — Details itself contains no per-domain
// branching, it only asks "is this field present on my schema?" and
// renders accordingly. A field absent from a model's entry (e.g. `date:
// null`) simply never renders, no special-casing needed on either side.
//
// Deliberately NOT in here (by agreement, see anypay-concept discussion):
//   - formTitle / formSubtitle — dropped, the hex-menu tooltip already
//     covers "what is this" before the user ever opens Details.
//   - location — its own hex/flow, built separately.
//   - submitLabel — Details has no submit button; SUBMIT/SEARCH live on
//     their own hex in the menu.
//
// Every field below is required once present, EXCEPT `date`, which is
// only required when `date.required === true`. `modeSelector` is never
// part of the required-chain — it always has a sensible default
// (In-Person), so it can never block SUBMIT from turning green.

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
  
  // ─── Schema, keyed by model id ───
  //
  // NOTE — gap, not guessed: 'vehicle_ride_sharing' (Move domain, 2nd
  // model in HexMenu.svelte's DOMAINS) has no row in the form-schema
  // table and so has no entry here. Details.svelte falls back to a
  // "not defined yet" state for it rather than inventing placeholder
  // copy. Add it here once the table has a row for it.
  export const FORM_SCHEMA = {
    vehicle_exchange: {
      titleLabel: 'Vehicle Title',
      titlePlaceholder: 'e.g. Mountain Bike, Family Car, Fishing Boat...',
      category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "Describe the vehicle and how you'd like to share or swap it...",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    p2p_vehicle_rental: {
      titleLabel: 'Vehicle Title',
      titlePlaceholder: 'e.g. Scooter for Rent, Weekend Camper...',
      category: { options: MOVE_VEHICLE_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'Describe the vehicle, availability, and rental terms...',
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    route_sharing: {
      titleLabel: 'Trip Title',
      titlePlaceholder: 'e.g. Cebu → Manila, Tomorrow 8 AM...',
      category: { options: ROUTE_SHARING_CATEGORIES, multi: true },
      date: { label: 'Departure', required: true },
      descriptionPlaceholder: 'Anything riders or senders should know — luggage space, recurring trips, pets, pickup flexibility, etc.',
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    goods_sharing: {
      titleLabel: 'Item Title',
      titlePlaceholder: 'e.g. Power Drill, Camping Tent, Garden Plot...',
      category: { options: GOODS_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "Describe the item and how you'd like to share, lend, or swap it...",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    food_production: {
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Sourdough Bread, Weekly Meal Boxes...',
      category: { options: FOOD_PRODUCTION_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'What are you making, and how can people get it?',
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    meal_sharing: {
      titleLabel: 'Meal Title',
      titlePlaceholder: 'e.g. Sunday Dinner, Neighborhood BBQ...',
      category: { options: MEAL_SHARING_CATEGORIES, multi: false },
      date: { label: 'Date & Time', required: false },
      descriptionPlaceholder: "What's on the menu? Tell people about the meal and the gathering.",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    food_exchange: {
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Extra Tomatoes, Leftover Bread...',
      category: { options: FOOD_EXCHANGE_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'What do you have available, and what (if anything) would you like in return?',
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    food_rescue: {
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. End-of-Day Bakery Surplus, Grocery Overstock...',
      category: { options: FOOD_RESCUE_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "What's available, how much is there, and when should it be collected?",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    freelance_work: {
      modeSelector: true,
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Logo Design, Web Development...',
      category: { options: HELPOUT_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "What can you offer, and what's your experience?",
      contactHint: 'Telegram, WhatsApp, Signal, Zoom, or any link',
    },
    production: {
      modeSelector: true,
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Custom Furniture, 3D-Printed Parts...',
      category: { options: PRODUCTION_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'What can you make, and what do you need from the other person to get started?',
      contactHint: 'Telegram, WhatsApp, Signal, Zoom, or any link',
    },
    skill_pooling: {
      modeSelector: true,
      titleLabel: 'Project Title',
      titlePlaceholder: 'e.g. Open Source App...',
      category: { options: HELPOUT_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "What's the project, and what skills are you looking to combine?",
      contactHint: 'Telegram, WhatsApp, Signal, Zoom, or any link',
    },
    helpout: {
      modeSelector: true,
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Help Installing Shelves, Need Gardening Help...',
      category: { options: HELPOUT_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'What do you need help with, or what would you like to help others with?',
      contactHint: 'Telegram, WhatsApp, Signal, Zoom, or any link',
    },
    stay_exchange: {
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Guest Room in Cebu...',
      category: { options: STAY_EXCHANGE_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: "Describe the space and the kind of exchange or stay you're offering.",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    stay_pooling: {
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Airbnb in Bali...',
      category: { options: STAY_POOLING_CATEGORIES, multi: false },
      date: null,
      descriptionPlaceholder: 'Describe the accommodation and how the costs will be shared.',
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    social_activity_sharing: {
      modeSelector: true,
      titleLabel: 'Event Title',
      titlePlaceholder: 'e.g. Saturday Morning Run, Board Game Night...',
      category: { options: SOCIAL_CATEGORIES, multi: false },
      date: { label: 'Date & Time', required: false },
      descriptionPlaceholder: "What's the plan? Tell people about the activity.",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
    social_time: {
      titleLabel: 'Project Title',
      titlePlaceholder: 'e.g. Beach Clean-Up...',
      category: { options: SOCIAL_TIME_CATEGORIES, multi: false },
      date: { label: 'Date & Time', required: false },
      descriptionPlaceholder: "What's the project about, and how can people help? Mention any useful skills if applicable—but everyone can decide for themselves whether they're a good fit.",
      contactHint: 'Telegram, WhatsApp, Signal, or any link',
    },
  };