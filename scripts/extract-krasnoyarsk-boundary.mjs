import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'krasnoyarsk-boundary-source.geojson');

const src = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (src.type !== 'FeatureCollection') {
  throw new Error('Expected FeatureCollection');
}

const feature = src.features.find((item) => item.properties?.osm_id === 1157393);
if (!feature) {
  throw new Error('Feature with osm_id=1157393 not found');
}
if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
  throw new Error(`Unexpected geometry type: ${feature.geometry.type}`);
}

const canonical = {
  type: 'Feature',
  properties: {
    osm_relation_id: 1157393,
    name: feature.properties.name ?? 'городской округ Красноярск',
    source: 'OpenStreetMap',
    admin_level: 6,
    boundary: 'administrative',
  },
  geometry: feature.geometry,
};

const apiPath = path.join(root, 'api/src/common/geo/krasnoyarsk-boundary.geojson');
const webPath = path.join(root, 'web/src/shared/geo/krasnoyarsk-boundary.geojson');

fs.mkdirSync(path.dirname(apiPath), { recursive: true });
fs.mkdirSync(path.dirname(webPath), { recursive: true });

const json = JSON.stringify(canonical);
fs.writeFileSync(apiPath, json);
fs.writeFileSync(webPath, json);

const statsPath = path.join(root, 'api/src/common/geo/boundary-stats.json');
const coords = feature.geometry.coordinates;
let minLng = Infinity;
let minLat = Infinity;
let maxLng = -Infinity;
let maxLat = -Infinity;

function walk(node) {
  if (typeof node[0] === 'number') {
    const [lng, lat] = node;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    return;
  }
  for (const child of node) {
    walk(child);
  }
}

walk(coords);

const stats = {
  geometryType: feature.geometry.type,
  rings:
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates.length
      : feature.geometry.coordinates.map((poly) => poly.length),
  outerRingPoints:
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0].length
      : feature.geometry.coordinates[0][0].length,
  bbox: [minLng, minLat, maxLng, maxLat],
  fileSizeBytes: Buffer.byteLength(json),
  osmRelationId: 1157393,
};

fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
