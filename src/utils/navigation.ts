/**
 * Utility helpers to build one-tap turn-by-turn navigation URLs
 * for Google Maps and Waze apps/web.
 */

export function getGoogleMapsUrl(destination: string, lat?: number, lng?: number): string {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function getWazeUrl(destination: string, lat?: number, lng?: number): string {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`;
}
