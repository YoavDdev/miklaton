export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function findNearestShelters(userLat, userLng, shelters, count = 3) {
  const sheltersWithDistance = shelters
    .filter(shelter => shelter.lat !== null && shelter.lng !== null)
    .map(shelter => ({
      ...shelter,
      distance: haversineDistance(userLat, userLng, shelter.lat, shelter.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  return sheltersWithDistance.slice(0, count);
}
