# Terra

Terra is an open-source, browser-based geospatial analysis and 3D terrain visualization application. It allows researchers, engineers, and outdoor enthusiasts to explore digital elevation models (DEMs), analyze topographic relief, and model hydrological dynamics directly in the browser without subscriptions, cloud APIs, or mandatory accounts.

---

## Implemented Features (Milestone 1 — Terrain Foundation)

- **Reusable Geospatial Data Model (`ElevationGrid`)**:
  - Strongly typed, memory-efficient representation using `Float32Array`.
  - Full raster coordinate transformations via standard 6-parameter affine georeferencing matrices (`gridToGeo` and `geoToGrid`).
  - Robust handling of NoData sentinels (e.g. `-9999.0`, `NaN`, GDAL metadata tags).
  - Deterministic elevation statistics computation (`min`, `max`, `mean`, `validCount`, `noDataCount`).
  - Spatial resolution calculation and nearest-neighbor resampling.
  - Zero dependencies on React or DOM APIs.
- **Client-Side GeoTIFF Loader**:
  - Loads and parses GeoTIFF files locally in the browser using `geotiff.js`.
  - Extracts affine tiepoints, pixel scales, model transformation matrices, and GDAL NoData tags.
  - Inspects GeoKeys for projected (UTM) and geographic (WGS 84) coordinate reference systems.
  - Surfaces explicit warnings when datasets lack georeferencing or use degree-based geographic CRS.
  - Never uploads DEM files to external servers.
- **Interactive 3D Terrain Rendering**:
  - High-performance WebGL mesh rendering via Three.js.
  - Generates indexed `BufferGeometry` with vertex positions, computed normals, UVs, and elevation colormapping.
  - Topographic color ramp ranging from forest green through ochre, mountain brown, rock slate, to alpine snow.
  - Orbit controls supporting camera rotation, panning, zooming, and vertical limit guards.
  - Dynamic vertical exaggeration scaling (0.1x to 5.0x) without rebuilding GPU buffers.
  - Wireframe inspection toggle.
  - Responsive canvas resizing via `ResizeObserver`.
  - Comprehensive GPU memory and resource disposal.
- **Synthetic Terrain Generator**:
  - Deterministic mathematical terrain generators (Mountain, Valley, Plane, Pyramid, Depression) for automated testing and quick visual exploration.
  - Pre-bundled sample DEM dataset (`/samples/sample_dem.tif`).

---

## Architecture & Technology Stack

- **Framework**: React 19, TypeScript (strict mode enabled with zero implicit any)
- **Bundler & Tooling**: Vite 6, ESLint, TypeScript-ESLint
- **Graphics**: Three.js (`WebGLRenderer`, `BufferGeometry`, `MeshStandardMaterial`, `OrbitControls`)
- **Geospatial Processing**: `geotiff.js`, TypedArrays (`Float32Array`)
- **Testing**: Vitest with deterministic unit test suites

---

## Local Installation & Setup

### Prerequisites

- Node.js (v20+ recommended)
- npm

### Installation

```bash
git clone https://github.com/username/terra.git
cd terra
npm install
```

### Development Server

```bash
npm run dev
```

### Verification & Quality Checks

```bash
# Type check TypeScript without emitting code
npm run typecheck

# Lint codebase with ESLint
npm run lint

# Run automated unit test suite
npm run test

# Production build
npm run build
```

---

## Current Limitations

- **Coordinate Units**: Geographic rasters (WGS 84 in degrees) use an approximate latitudinal meter-conversion factor. Full coordinate reprojection (e.g. via Proj4) is planned for later milestones.
- **Dataset Size**: Rasters are processed on the main thread in Milestone 1. Very large rasters (>2000x2000) should be resampled before mesh generation. Dedicated Web Worker offloading is scheduled for Milestone 5.
- **Depression Filling & Hydrology**: Flow direction, flow accumulation, and watershed delineation are out of scope for Milestone 1 and will be developed in Milestone 3.

---

## Next Milestone

- **Milestone 2: Terrain Analysis**:
  - Slope calculation (degrees and percentage).
  - Aspect calculation (compass azimuth 0–360°).
  - Analytical hillshade rendering with customizable sun azimuth and elevation angles.
  - Specialized analysis color ramps for slope and aspect.
