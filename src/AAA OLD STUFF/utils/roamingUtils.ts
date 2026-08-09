/**
 * Roaming utilities for handling model roaming behavior
 */


export interface RoamingAreaBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Calculate a random position within the roaming area
 */
export function getRandomPositionInArea(area: RoamingAreaBounds): { latitude: number; longitude: number } {
  const latitude = area.south + Math.random() * (area.north - area.south);
  const longitude = area.west + Math.random() * (area.east - area.west);
  
  return { latitude, longitude };
}

/**
 * Calculate distance between two points in meters
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generate a random heading (0-360 degrees)
 */
export function getRandomHeading(): number {
  return Math.random() * 360;
}

