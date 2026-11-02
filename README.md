# Terra

Terra is an open-source, browser-based geospatial analysis and 3D terrain visualization application. It allows researchers, engineers, and outdoor enthusiasts to explore digital elevation models (DEMs), analyze topographic relief, and model hydrological dynamics directly in the browser without subscriptions, cloud APIs, or mandatory accounts.

---

## Implemented Features

### Milestone 1 — Terrain Foundation
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

### Milestone 2 — Terrain Analysis
- **Topographic Slope (Horn's 3x3 Finite Differences)**:
  - Strongly typed, modular calculation independent of React.
  - Accounts for real pixel spacing ($dx, dy$) in geographic or projected metric units.
  - Supports output in angular degrees ($0^\circ–90^\circ$) and gradient percentage ($0\%–\infty\%$).
  - Boundary-safe partial derivative evaluation preventing NoData corruption at grid edges.
- **Directional Aspect (Compass Azimuth $0^\circ–360^\circ$)**:
  - Mathematically sound downhill facing calculation clockwise from true North ($0^\circ$ North, $90^\circ$ East, $180^\circ$ South, $270^\circ$ West).
  - Explicit detection and handling of flat terrain with sentinel value `-1`.
  - Directional statistics: Circular mean azimuth calculation avoiding angular wrapping artifacts.
  - 8-cardinal histogram binning identifying dominant slope facing direction and distribution.
- **Analytical Shaded Relief (Hillshade)**:
  - Lambertian cosine illumination model based on surface normals and solar vector.
  - Interactive sun azimuth ($0^\circ–360^\circ$) and solar altitude ($0^\circ–90^\circ$) parameters.
  - Real-time Three.js directional light synchronization with solar controls.
- **Perceptually Uniform Color Ramps & Dynamic Draping**:
  - Slope warning gradient (emerald green $\to$ amber $\to$ orange $\to$ crimson red).
  - Aspect cyclic 360° multi-hue palette with seamless North closure and neutral flat grey.
  - Hillshade grayscale illumination ramp ($0$ shadow $\to$ $255$ highlight).
  - In-place vertex color buffer updates (`needsUpdate = true`) switching layers at 60 FPS without reallocating geometry.
- **UI Analysis Workspace & Legends**:
  - Analysis layer selector (Elevation, Slope, Aspect, Hillshade).
  - Interactive gradient legend cards with range labels.
  - Live statistical summaries (Mean Slope, Max Slope, Dominant Facing %, Circular Mean, Mean Shading).

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

- **Coordinate Reprojection**: Geographic rasters (WGS 84 in degrees) use an approximate latitudinal metric factor ($111,320\text{ m/deg}$). Full coordinate reprojection (e.g. via Proj4) is planned for future milestones.
- **Raster Processing Concurrency**: Large rasters are processed synchronously; Web Worker offloading is scheduled for Milestone 5.
- **Hydrological Depression Preprocessing**: Sink filling and hydrological routing are scheduled for Milestone 3.

---

## Next Milestone

- **Milestone 3 — Hydrology**:
  - D8 flow direction calculation.
  - Depression and flat handling (sink filling / carving).
  - Flow accumulation raster.
  - Stream network and drainage path extraction.
  - Contributing watershed delineation from arbitrary pour points.
