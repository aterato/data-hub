"use strict";

// Ray casting with explicit edge inclusion; polygon holes remain excluded.
function ringContains(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj)
      && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function findMunicipality(data, longitude, latitude) {
  const point = [longitude, latitude];
  for (const feature of data.features) {
    const [west, south, east, north] = feature.bbox;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    if (polygons.some(rings => ringContains(point, rings[0])
      && !rings.slice(1).some(hole => ringContains(point, hole)))) return feature.properties.name;
  }
  return null;
}
