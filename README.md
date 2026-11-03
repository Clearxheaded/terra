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
  - Analysis layer selector (Elevation, Slope, Aspect, Hillshade, D8 Flow, Flow Accumulation).
  - Interactive gradient legend cards with range labels.
  - Live statistical summaries (Mean Slope, Max Slope, Dominant Facing %, Circular Mean, Mean Shading).

### Milestone 3 — Hydrology
- **DEM Depression Preprocessing (Barnes Priority-Flood)**:
  - Optimal $O(N \log N)$ sink filling using a cache-friendly typed-array binary min-heap.
  - Raises enclosed interior pits to their lowest natural spillover sill elevation while preserving true downhill drainage slopes.
  - Supports optional infinitesimal downward $\epsilon$-gradient ($10^{-5}\text{ m}$) for complete flat resolution.
  - Toggle between raw unconditioned DEM routing and hydrologically conditioned surface routing.
- **D8 Flow Direction Algorithm**:
  - Computes steepest downward descent among 8 neighbors according to O'Callaghan & Mark (1984).
  - True metric distance weighting: cardinal distances $dx, dy$ and diagonal distances $\sqrt{dx^2 + dy^2}$, eliminating grid diagonal bias.
  - Standard D8 bit-coding: 1 (E), 2 (SE), 4 (S), 8 (SW), 16 (W), 32 (NW), 64 (N), 128 (NE), and 0 (pits, flats, outlets, NoData).
  - Deterministic tie-breaking policy (clockwise order starting from East).
  - Robust boundary and NoData guardrails preventing invalid edge routing.
- **Topological Flow Accumulation**:
  - In-degree dependency ordering guarantees $O(N)$ execution and absolute cycle freedom (zero infinite loops).
  - Supports linear and log10-scaled accumulation ($\log_{10}(\text{cells})$) for high dynamic range hypsometric river visualization.
  - Reports maximum contributing cells, mean accumulation, and peak drainage coordinate.
- **Stream Extraction & 3D Vector Drape**:
  - Channel initiation thresholding extracting dendritic stream networks.
  - Draped 3D vector polyline overlays rendered in Three.js floating slightly above terrain geometry to prevent z-fighting.
- **Interactive Pour Point Inspection & Watershed Delineation**:
  - Raycasts the 3D terrain surface on click to locate exact raster $(col, row)$ coordinates and elevation.
  - Delineates the entire upstream contributing watershed via reverse-flow breadth-first search.
  - Dynamically highlights the contributing basin on the 3D terrain while dimming unselected landscape.
  - Computes contributing drainage area in $\text{km}^2$, total cell count, and basin percentage.
  - Traces the complete downstream flow path polyline from the selected point to the ocean/basin outlet.

### Milestone 4 — Analysis Workspace
- **Topographic Elevation Profiling (`src/features/analysis/profile.ts`)**:
  - 2D cross-section elevation profiling along arbitrary user-defined transects.
  - Bilinear interpolation with NoData-resilient normalized weighting across fractional grid coordinates.
  - Calculates cumulative horizontal ground distance, cumulative 3D surface distance accounting for slope, min/max/mean elevation, and total elevation gain/loss.
  - Interactive transect drawing tool: click endpoints A and B on the 3D terrain to define a cut.
  - Responsive SVG cross-section profile drawer with area gradient fill, metric axes, and statistics row.
  - Interactive hover scrubber synchronized with a real-time glowing 3D indicator marker on the terrain mesh.
- **Multi-Layer Blending & Visualization Controls**:
  - Real-time cartographic layer blending: base terrain (Elevation or Hillshade) blended with analysis overlays (Slope, Aspect, D8 Flow, Flow Accumulation).
  - Configurable overlay opacity slider (0% to 100%).
  - Mathematical blend modes: Normal (alpha interpolation), Multiply (modulates shaded relief over color ramps), and Overlay (contrast enhancement).
  - Camera bookmark presets: Top-Down (2D orthographic map view), Isometric 45°, and Oblique low-angle horizon view.
- **Real-Time Coordinate & Terrain Inspection HUD**:
  - Live cursor hover inspection on the 3D terrain mesh.
  - Monospace readout displaying raster cell $[col, row]$, geographic coordinates (Lat/Lon or Easting/Northing), elevation (meters and feet), local slope (degrees and percent), aspect (cardinal direction + degrees), and flow accumulation (contributing cells).
- **Client-Side Geospatial Export Suite (`src/features/export/`)**:
  - **High-Resolution Viewport PNG**: captures WebGL canvas with dynamic orientation compass rose (synchronized to camera azimuth) and metric scale bar.
  - **32-Bit Float GeoTIFF Export**: encodes active analysis layer (Slope, Aspect, Flow Accumulation, or Elevation) into an authentic IEEE 754 32-bit floating point GeoTIFF with full ModelPixelScale, ModelTiepoint, and GeoKeyDirectory tags.
  - **Vector GeoJSON Export**: exports extracted stream network channels as standard GeoJSON `LineString` features and delineated watershed boundaries as closed GeoJSON `Polygon` features.
  - **Elevation Profile CSV**: exports sampled distance, elevation, coordinates, and slope data along transects.

### Milestone 5 — Performance & Web Workers
- **Web Worker Computation Pipeline (`src/workers/`)**:
  - Dedicated Web Worker execution for all computationally intensive terrain algorithms:
    - **`derivatives.worker.ts`**: Single-pass simultaneous computation of Horn's slope, circular aspect, and analytical hillshade.
    - **`priority-flood.worker.ts`**: Non-blocking Barnes Priority-Flood sink filling and flat resolution.
    - **`hydrology.worker.ts`**: D8 flow routing and in-degree topological flow accumulation.
  - **Zero-Copy Transferable Buffers**:
    - Transfers typed arrays (`Float32Array`, `Uint8Array`) between main thread and worker threads via `ArrayBuffer` transfer lists, eliminating UI stutter, serialization latency, and garbage collection overhead.
  - **Typed Messaging Protocol & Progress Reporting**:
    - Strongly typed request/response envelopes (`WorkerRequest`, `WorkerProgressResponse`, `WorkerSuccessResponse`, `WorkerErrorResponse`).
    - Emits granular stage-by-stage percentage progress for long-running operations.
  - **Isomorphic Client Fallback (`TerrainWorkerClient`)**:
    - Asynchronous worker bridge automatically falls back to optimized main-thread execution when running in non-worker environments (e.g. Node.js unit tests and SSR).
- **Large Raster Memory Bounding & Decimation (`src/lib/geospatial/memory-manager.ts`)**:
  - Real-time memory allocation estimation (`estimateRasterMemoryUsage`) evaluating raw elevation arrays, analysis buffers, and GPU geometry memory.
  - Guardrails against browser tab crashes on high-resolution rasters ($> 2048 \times 2048$ cells, $> 4.2\text{M}$ cells) with actionable user warnings.
  - Structurally sound grid decimation (`decimateGrid`) preserving geotransforms, pixel spacing, CRS definitions, and NoData sentinels.
- **Adaptive Level-of-Detail (LOD) Geometry & WebGL Optimization (`src/features/terrain/terrain-mesh.ts`)**:
  - Dynamic geometry subsampling for massive rasters to respect GPU vertex budgets (bounded at $\le 1,000,000$ vertices for smooth 60 FPS interaction).
  - Maintains full-resolution UV mapping, ensuring raycasting and cursor HUD point inspections remain 100% full-resolution.
  - In-place vertex color updates (`updateTerrainGeometryColors`) with zero geometry re-allocation.
- **Real-Time WebGL Performance Monitor (`src/features/terrain/terrain-viewer.ts`, `src/components/TerrainHUD.tsx`)**:
  - Monitored real-time metrics: FPS (rolling frame average), frame time (ms), triangle counts, WebGL draw calls, and active LOD stride.
  - Live HUD stats pill with green/amber/red performance thresholds.
- **Automated Performance Benchmark Suite (`tests/benchmarks/`)**:
  - Reproducible benchmark harness measuring cell throughput ($\text{Mcells/sec}$) and latency on synthetic elevation models up to 4.19 million cells.

#### Empirical Benchmark Throughput

| Algorithm | Grid Dimensions | Total Cells | Latency (ms) | Throughput (Mcells/s) |
| :--- | :---: | :---: | :---: | :---: |
| **Horn's Slope** | $512 \times 512$ | 262,144 | ~20 ms | **~13.3 Mcells/s** |
| **Horn's Slope** | $1024 \times 1024$ | 1,048,576 | ~72 ms | **~14.5 Mcells/s** |
| **Horn's Slope** | $2048 \times 2048$ | 4,194,304 | ~274 ms | **~15.3 Mcells/s** |
| **Priority-Flood Filling** | $256 \times 256$ | 65,536 | ~10 ms | **~6.2 Mcells/s** |
| **Priority-Flood Filling** | $512 \times 512$ | 262,144 | ~45 ms | **~5.8 Mcells/s** |
| **Priority-Flood Filling** | $1024 \times 1024$ | 1,048,576 | ~189 ms | **~5.5 Mcells/s** |
| **D8 Flow Accumulation** | $512 \times 512$ | 262,144 | ~20 ms | **~12.9 Mcells/s** |
| **D8 Flow Accumulation** | $1024 \times 1024$ | 1,048,576 | ~74 ms | **~14.2 Mcells/s** |

---

## Architecture & Technology Stack

- **Framework**: React 19, TypeScript (strict mode enabled with zero implicit any)
- **Concurrency & Compute**: Web Workers, Transferable `ArrayBuffer` objects, TypedArrays (`Float32Array`, `Uint8Array`, `Int32Array`)
- **Bundler & Tooling**: Vite 6, ESLint, TypeScript-ESLint
- **Graphics**: Three.js (`WebGLRenderer`, `BufferGeometry`, `MeshStandardMaterial`, `OrbitControls`, `LineSegments`, `Line`)
- **Geospatial Processing**: `geotiff.js`, TypedArrays, custom mathematical terrain engine
- **Testing & Benchmarks**: Vitest with deterministic unit test suites and performance benchmarks

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

# Run performance benchmark suite
npm run bench

# Production build
npm run build
```

---

## Current Limitations

- **Coordinate Reprojection**: Geographic rasters (WGS 84 in degrees) use an approximate latitudinal metric factor ($111,320\text{ m/deg}$). Full coordinate reprojection (e.g. via Proj4) is planned for future milestones.
- **Multi-Flow Direction (MD8/D-Infinity)**: Currently implements deterministic single-flow D8 routing; dispersive flow algorithms are planned as advanced options.

---

## Next Milestone

- **Milestone 6 — Public Release**:
  - Documentation and interactive guides.
  - Public example datasets.
  - GitHub Actions CI/CD workflows for automated testing and typechecking.
  - Browser-based end-to-end tests (Playwright).
  - Screenshots and demo recordings.
  - Static production deployment.
