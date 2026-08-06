// locationSchema.ts

export type GeometryType = 'point' | 'route';

export interface LocationSchema {
  geometry: GeometryType;
}

export const LOCATION_SCHEMA: Record<string, LocationSchema> = {
  // Move
  vehicle_exchange:     { geometry: 'point' },
  p2p_vehicle_rental:   { geometry: 'point' },
  route_sharing:        { geometry: 'route' },

  // Goods
  goods_sharing:        { geometry: 'point' },

  // Food
  food_production:      { geometry: 'point' },
  meal_sharing:         { geometry: 'point' },
  food_exchange:        { geometry: 'point' },
  food_rescue:          { geometry: 'point' },

  // Help
  freelance_work:       { geometry: 'point' },
  production:           { geometry: 'point' },
  skill_pooling:        { geometry: 'point' },
  helpout:              { geometry: 'point' },

  // Stay
  stay_exchange:        { geometry: 'point' },
  stay_pooling:         { geometry: 'point' },

  // Social
  social_activity_sharing: { geometry: 'point' },
  social_time:             { geometry: 'point' },

  // Live
  need_ride:            { geometry: 'route' },
  offer_ride:           { geometry: 'route' },
};