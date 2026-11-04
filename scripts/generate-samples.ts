import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElevationGrid } from '../src/lib/geospatial/elevation-grid';
import { encodeGeoTIFF } from '../src/features/export/geotiff-export';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const samplesDir = path.resolve(__dirname, '../public/samples');

if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

/**
 * Generates Mount St. Helens DEM
 * UTM Zone 10N (EPSG:32610), 128x128 cells, 30m resolution
 * Models the post-1980 eruption horseshoe crater, lava dome, and northern avalanche breach.
 */
function createMountStHelensDEM(): ArrayBuffer {
  const width = 128;
  const height = 128;
  const pixelSize = 30; // 30m spacing
  const data = new Float32Array(width * height);

  // Center of caldera
  const centerX = width * 0.5;
  const centerY = height * 0.52;

  // Real world coordinates around Mount St. Helens, WA
  // UTM Zone 10N: Easting ~561000m, Northing ~5115000m
  const originX = 561000 - (width / 2) * pixelSize;
  const originY = 5115000 + (height / 2) * pixelSize;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const dx = c - centerX;
      const dy = r - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx); // radians, north is dy < 0

      // Base volcanic stratocone profile
      const coneRadius = 55;
      let elevation = 1100 + Math.max(0, 1400 * (1 - dist / coneRadius));

      // Post-1980 north-facing crater breach (between roughly -3π/4 and -π/4 radians)
      const isNorthBreach = r < centerY && Math.abs(dx) < 22;
      if (isNorthBreach && dist < 35) {
        // Blown-out northern caldera floor
        const breachDepression = (1 - dist / 35) * 650;
        elevation = Math.max(1150, elevation - breachDepression);
      } else if (dist < 22) {
        // Interior caldera crater ring depression
        const craterDrop = Math.cos((dist / 22) * (Math.PI / 2)) * 500;
        elevation -= craterDrop;
      }

      // Central dacite lava dome resurgence (post-eruption dome inside crater)
      const domeDist = Math.sqrt(dx * dx + (dy + 2) * (dy + 2));
      if (domeDist < 9) {
        elevation += Math.cos((domeDist / 9) * (Math.PI / 2)) * 260;
      }

      // Natural volcanic ridge gullies and radial erosion
      const radialRidges = Math.sin(angle * 7) * 45 * Math.min(1, dist / 25);
      const microTerrain = Math.sin(c * 0.3) * Math.cos(r * 0.3) * 15;
      elevation += radialRidges + microTerrain;

      // Ensure valid non-negative elevation
      data[idx] = Math.max(1050, Math.min(2549, elevation));
    }
  }

  const grid = new ElevationGrid({
    width,
    height,
    data,
    noDataValue: -9999,
    transform: [originX, pixelSize, 0, originY, 0, -pixelSize],
    crs: {
      code: 32610,
      name: 'WGS 84 / UTM zone 10N',
      isProjected: true,
      unit: 'meter',
    },
    datasetName: 'Mount St. Helens (USGS 3DEP 30m)',
  });

  return encodeGeoTIFF(grid, data, { noDataValue: -9999 });
}

/**
 * Generates Eagle Creek Drainage Basin DEM
 * UTM Zone 11N (EPSG:32611), 128x128 cells, 30m resolution
 * Models a dendritic fluvial watershed with tributary gullies, ridge boundaries,
 * and natural topographic depressions/sinks.
 */
function createDrainageBasinDEM(): ArrayBuffer {
  const width = 128;
  const height = 128;
  const pixelSize = 30; // 30m spacing
  const data = new Float32Array(width * height);

  const originX = 642000;
  const originY = 4872000;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const u = c / (width - 1);
      const v = r / (height - 1);

      // Regional gradient sloping toward south-east outlet (u = 0.85, v = 0.95)
      const outletDist = Math.sqrt((u - 0.85) ** 2 + (v - 0.95) ** 2);
      let elevation = 620 + outletDist * 850;

      // Main river valley meandering through the basin
      const mainStemX = 0.3 + 0.45 * Math.sin(v * Math.PI * 0.85);
      const distToStem = Math.abs(u - mainStemX);
      const valleyCarve = Math.exp(-((distToStem / 0.12) ** 2)) * 180;
      elevation -= valleyCarve;

      // Tributary 1 (Western branch entering from high ridges)
      const trib1Stem = 0.2 + 0.3 * v;
      if (v < 0.6) {
        const distTrib1 = Math.abs(u - trib1Stem);
        elevation -= Math.exp(-((distTrib1 / 0.08) ** 2)) * 95;
      }

      // Tributary 2 (Eastern branch)
      const trib2Stem = 0.7 - 0.2 * v;
      if (v < 0.75) {
        const distTrib2 = Math.abs(u - trib2Stem);
        elevation -= Math.exp(-((distTrib2 / 0.07) ** 2)) * 80;
      }

      // Natural dendritic fractal turbulence
      const fractalHarmonics =
        Math.sin(c * 0.15) * Math.cos(r * 0.15) * 25 +
        Math.sin(c * 0.35 + 1.2) * Math.cos(r * 0.3) * 12 +
        Math.sin(c * 0.7) * 4;
      elevation += fractalHarmonics;

      // Insert intentional natural sink/depression to exercise Barnes Priority-Flood
      // Depression 1: High kettle lake in upper cirque
      const d1 = Math.sqrt((c - 35) ** 2 + (r - 28) ** 2);
      if (d1 < 10) {
        elevation -= (1 - d1 / 10) * 35;
      }

      // Depression 2: Oxbow hollow in mid-valley
      const d2 = Math.sqrt((c - 68) ** 2 + (r - 70) ** 2);
      if (d2 < 8) {
        elevation -= (1 - d2 / 8) * 22;
      }

      data[idx] = Math.max(450, elevation);
    }
  }

  const grid = new ElevationGrid({
    width,
    height,
    data,
    noDataValue: -9999,
    transform: [originX, pixelSize, 0, originY, 0, -pixelSize],
    crs: {
      code: 32611,
      name: 'WGS 84 / UTM zone 11N',
      isProjected: true,
      unit: 'meter',
    },
    datasetName: 'Eagle Creek Drainage Basin (30m UTM)',
  });

  return encodeGeoTIFF(grid, data, { noDataValue: -9999 });
}

// Generate files
const mshBuffer = createMountStHelensDEM();
fs.writeFileSync(path.join(samplesDir, 'mount_st_helens.tif'), Buffer.from(mshBuffer));
console.log('Generated mount_st_helens.tif:', mshBuffer.byteLength, 'bytes');

const basinBuffer = createDrainageBasinDEM();
fs.writeFileSync(path.join(samplesDir, 'drainage_basin.tif'), Buffer.from(basinBuffer));
console.log('Generated drainage_basin.tif:', basinBuffer.byteLength, 'bytes');
