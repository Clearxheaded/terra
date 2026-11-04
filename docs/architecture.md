# Terra — Architectural Specification & Engineering Reference

Terra is an open-source, client-side geospatial analysis and 3D terrain rendering platform built with TypeScript, React, Vite, and Three.js. It operates entirely within the browser without server dependencies, external cloud APIs, or telemetry.

This document details the mathematical models, algorithmic derivations, geospatial transformations, and computer graphics pipelines powering the engine.

---

## 1. Geospatial Data Model & Coordinate Systems

A Digital Elevation Model (DEM) is fundamentally a discrete 2D spatial scalar field $z = f(x, y)$ mapped across a continuous planetary surface. Processing elevation rasters requires strict mathematical handling of coordinate systems, geodetic datums, affine georeferencing, and missing data policies.

### 1.1 Projected vs. Geographic Coordinate Systems

Geospatial coordinate reference systems (CRS) fall into two categories:

1. **Geographic Coordinate Systems (GCS)** (e.g., WGS 84 / EPSG:4326):
   - Coordinates are spherical angles: longitude ($\lambda$) and latitude ($\phi$) in decimal degrees.
   - Spatial distance per angular degree varies as a function of latitude:
     $$\Delta x_{\text{meters}} \approx R_E \cdot \cos(\phi) \cdot \Delta \lambda \cdot \frac{\pi}{180^{\circ}}$$
     $$\Delta y_{\text{meters}} \approx R_E \cdot \Delta \phi \cdot \frac{\pi}{180^{\circ}}$$
     where $R_E \approx 6,378,137\text{ m}$ (WGS 84 equatorial radius).
   - *Limitation*: Because angular units are non-metric and anisotropic ($\Delta x \ne \Delta y$ on the ground), calculating linear gradients, surface slopes, volumetric flow accumulations, and isometric 3D meshes directly on geographic degree rasters without geodetic scale correction introduces severe distortion (stretching gradients along the longitudinal axis).

2. **Projected Coordinate Systems (PCS)** (e.g., Universal Transverse Mercator / UTM Zones EPSG:32601–32660):
   - Coordinates are planar Cartesian metrics: Easting ($X$) and Northing ($Y$) in meters.
   - The cell spacing $\Delta x$ and $\Delta y$ represents metric ground distance across the entire local raster envelope.
   - **Terra Requirement**: For all topographic derivatives (slope, aspect, hillshade) and hydrological routing (Priority-Flood, D8 flow, accumulation), Terra enforces metric projection units. If a dataset lacks a recognized metric CRS, Terra emits a descriptive metadata warning and assumes isometric spatial units.

### 1.2 Affine Georeferencing Transformations

Raster cells $(col, row)$ map to world coordinates $(X_{\text{geo}}, Y_{\text{geo}})$ via a 6-parameter affine transformation matrix:

$$\begin{bmatrix} X_{\text{geo}} \\ Y_{\text{geo}} \\ 1 \end{bmatrix} = \begin{bmatrix} A & B & C \\ D & E & F \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} col \\ row \\ 1 \end{bmatrix}$$

Expanding the linear system:
$$X_{\text{geo}} = C + A \cdot col + B \cdot row$$
$$Y_{\text{geo}} = F + D \cdot col + E \cdot row$$

Where:
- $C = X_{\text{origin}}$: World Easting/Longitude of the top-left pixel corner.
- $F = Y_{\text{origin}}$: World Northing/Latitude of the top-left pixel corner.
- $A = \Delta x$: Pixel width / horizontal spatial resolution ($> 0$).
- $E = -\Delta y$: Pixel height / vertical spatial resolution (typically $< 0$ for north-up rasters where row indices increase downward while northing increases upward).
- $B, D$: Rotational skew coefficients (equal to $0$ for north-oriented, unrotated grids).

#### Coordinate Registration Conventions: PixelIsArea vs. PixelIsPoint
- **PixelIsArea (Cell Center)**: The affine origin $(C, F)$ defines the outer top-left bounding corner of cell $(0, 0)$. The spatial center of cell $(c, r)$ is at:
  $$X_{\text{center}} = C + (c + 0.5) \cdot A, \quad Y_{\text{center}} = F + (r + 0.5) \cdot E$$
- **PixelIsPoint (Node / Vertex)**: The affine origin $(C, F)$ corresponds exactly to the discrete sample point of cell $(0, 0)$.

Terra supports both conventions, defaulting to `PixelIsArea` as standardized by USGS and GDAL raster specifications.

### 1.3 Missing Data & NoData Policy

Elevation grids often contain masked or out-of-bounds regions (ocean surfaces, clipped administrative boundaries, radar shadowing).

1. **NoData Sentinels**: Identified by explicit metadata tags (e.g., GDAL NoData value `-9999`, `-3.4028235e+38`, or IEEE 754 `NaN`).
2. **Sentinel Invariance**: All internal mathematical kernels treat sentinel values as non-participating invalid cells.
3. **Neighborhood Stencils**: In 3x3 derivative filters (Horn's slope) and 8-neighbor hydrological routing (D8), if the center cell is NoData, the derivative is set to `NaN`. If peripheral neighbor cells are NoData or out-of-bounds, the filter masks them out or reflects nearest valid interior cells to prevent arithmetic contamination.
4. **Visual Masking**: In the Three.js 3D viewport, vertices marked as NoData have their vertical displacement clamped to the grid base and their color attribute assigned a transparent/masked sentinel color (`rgba(0, 0, 0, 0)`), or discarded via fragment discarding.

---

## 2. Topographic Analysis Algorithms

Terra implements mathematically rigorous surface derivative algorithms directly in compiled TypeScript, executed on multi-threaded Web Workers.

```
       [ a ] [ b ] [ c ]      Cell Neighborhood:
       [ d ] [ e ] [ f ]      e = (col, row)
       [ g ] [ h ] [ i ]      Grid spacing: Δx, Δy
```

### 2.1 Horn's Finite-Difference Slope Algorithm

Slope represents the maximum rate of change of elevation from a cell to its neighbors. Terra uses **Horn's (1981) 3×3 weighted finite-difference formulation**, which provides quadratic surface fitting with 2:1 distance weighting for orthogonal versus diagonal neighbors, minimizing discretization noise compared to simple 2-point central differences.

Given the 3×3 elevation matrix:
$$\begin{matrix} z(c-1, r-1) = a & z(c, r-1) = b & z(c+1, r-1) = c \\ z(c-1, r) = d & z(c, r) = e & z(c+1, r) = f \\ z(c-1, r+1) = g & z(c, r+1) = h & z(c+1, r+1) = i \end{matrix}$$

The partial derivatives in the horizontal and vertical directions are:
$$\frac{\partial z}{\partial x} = p = \frac{(c + 2f + i) - (a + 2d + g)}{8 \cdot \Delta x}$$

$$\frac{\partial z}{\partial y} = q = \frac{(g + 2h + i) - (a + 2b + c)}{8 \cdot \Delta y}$$

The magnitude of the maximum surface gradient is:
$$\|\nabla z\| = \sqrt{p^2 + q^2}$$

#### Slope Metrics
- **Degrees**:
  $$\text{Slope}_{\text{deg}} = \arctan\left(\sqrt{p^2 + q^2}\right) \times \frac{180^{\circ}}{\pi} \quad \in [0^{\circ}, 90^{\circ})$$
- **Percent Rise**:
  $$\text{Slope}_{\text{pct}} = \tan\left(\text{Slope}_{\text{rad}}\right) \times 100\% = \sqrt{p^2 + q^2} \times 100\% \quad \in [0, \infty)$$

### 2.2 Aspect Calculation

Aspect defines the compass direction toward which the surface slope faces downslope (azimuth of the gradient vector $-\nabla z$).

Using the finite-difference derivatives $p$ and $q$:
$$\theta = \operatorname{atan2}(q, -p) \quad \text{(mathematical angle in radians)}$$

Converting to geographic compass azimuth measured clockwise from true North ($0^{\circ} = \text{North}$, $90^{\circ} = \text{East}$, $180^{\circ} = \text{South}$, $270^{\circ} = \text{West}$):

$$\text{Aspect}_{\text{deg}} = \begin{cases}
-1.0 & \text{if } p = 0 \text{ and } q = 0 \quad (\text{Flat surface}) \\
\left(450.0 - \theta \cdot \frac{180^{\circ}}{\pi}\right) \pmod{360.0} & \text{otherwise}
\end{cases}$$

### 2.3 Analytical Lambertian Hillshade

Hillshade models the theoretical illumination intensity of the terrain surface under a simulated celestial light source, assuming ideal Lambertian diffuse reflectance (intensity proportional to the cosine of the angle of incidence $\theta_i$ between the surface normal $\mathbf{\hat{n}}$ and the illumination vector $\mathbf{\hat{s}}$).

Let:
- $\alpha_s \in [0^{\circ}, 360^{\circ})$ be the solar azimuth angle.
- $\beta_s \in (0^{\circ}, 90^{\circ}]$ be the solar altitude (elevation) angle above the horizon.
- $\zeta_s = 90^{\circ} - \beta_s$ be the solar zenith angle in radians.
- $\alpha_{\text{rad}}$ be the terrain aspect angle in radians.
- $S_{\text{rad}}$ be the terrain slope angle in radians.

The analytical hillshade formula evaluates to:
$$\cos(\theta_i) = \cos(\zeta_s) \cos(S_{\text{rad}}) + \sin(\zeta_s) \sin(S_{\text{rad}}) \cos(\alpha_{s,\text{rad}} - \alpha_{\text{rad}})$$

Quantized to an 8-bit grayscale display value $[0, 255]$:
$$\text{Hillshade} = \operatorname{round}\left(255.0 \times \max(0.0, \cos(\theta_i))\right)$$

---

## 3. Hydrological Modeling Pipeline

Hydrological modeling on raw DEMs requires transforming a noisy scalar field into a directed, acyclic drainage graph (DAG).

```
 Raw DEM ──> [ Priority-Flood Sink Filling ] ──> Depression-Free DEM
                         │
                         ▼
             [ D8 Steepest Descent Routing ] ──> Flow Direction Matrix
                         │
                         ▼
             [ In-Degree Topological Sort ] ──> Flow Accumulation
                         │
                         ▼
             [ Watershed & Stream Extraction ] ──> Vector Drainage Basin
```

### 3.1 Barnes' Priority-Flood Depression Filling

Natural and interpolated DEMs contain artificial sinks (depressions with no downslope exit), often resulting from LiDAR canopy filtering artifacts, sensor noise, or bridge embankments. Standard flow routing terminates in sinks, forming disconnected hydrological sinks.

Terra implements the **Barnes, Lehman, and Mulla (2014) Priority-Flood** algorithm, running in $O(N \log N)$ time using a typed binary min-heap:

1. **Boundary Seeding**: All boundary perimeter cells of the raster are pushed onto a priority queue (min-heap), ordered by elevation:
   $$\mathcal{Q} \leftarrow \{ (c, r, z(c, r)) \mid (c, r) \in \partial \mathcal{G} \}$$
   A boolean visitation bitset `visited` marks all boundary cells as true.
2. **Spill Elevation Propagation**:
   - Pop the cell $u$ with minimum elevation $z_u$ from $\mathcal{Q}$.
   - For each unvisited neighbor $v$ of $u$:
     - Mark $v$ as visited.
     - If $z_v \le z_u$: cell $v$ is a sink or depression. Its elevation is raised to the spill elevation of its outlet:
       $$z'_v = z_u + \epsilon$$
       where $\epsilon = 10^{-5}\text{ m}$ is an infinitesimal gradient ensuring water flows continuously toward the boundary rather than ponding.
     - Else ($z_v > z_u$): cell $v$ is higher than the spillway; its elevation remains unchanged: $z'_v = z_v$.
     - Push $v$ onto $\mathcal{Q}$ with elevation $z'_v$.
3. **Flat Surface Resolution**: The $\epsilon$ gradient resolves flat plains into valid outward drainage networks without iterative flat carving loops.

### 3.2 O'Callaghan & Mark D8 Flow Routing

The **D8 (Deterministic Eight-Node)** model assigns each cell a single flow direction pointing to the steepest neighbor among its 8 adjacent cells:

For cell $(c, r)$, the downslope gradient to neighbor $k \in \{0, \dots, 7\}$ is:
$$G_k = \frac{z(c, r) - z(c + \Delta c_k, r + \Delta r_k)}{d_k}$$

Where neighbor distance $d_k$ is:
$$d_k = \begin{cases} \Delta x & \text{for orthogonal neighbors (E, N, W, S)} \\ \sqrt{\Delta x^2 + \Delta y^2} & \text{for diagonal neighbors (NE, NW, SW, SE)} \end{cases}$$

The flow direction is assigned to the neighbor with maximum positive drop:
$$k^* = \arg\max_k G_k \quad \text{subject to } G_{k^*} > 0$$

Direction codes follow the power-of-two standard:
- East: $1$
- Southeast: $2$
- South: $4$
- Southwest: $8$
- West: $16$
- Northwest: $32$
- North: $64$
- Northeast: $128$
- Undefined / Pit: $0$

#### Deterministic Tie-Breaking
When two or more neighboring gradients are mathematically equal ($|G_i - G_j| < 10^{-7}$), Terra applies a deterministic counter-clockwise tie-breaking rule, preventing non-deterministic routing artifacts across different browsers.

### 3.3 Flow Accumulation via In-Degree Topological Sort

Flow accumulation quantifies the total contributing drainage area upstream of every cell. For a grid of $N$ cells, naive recursive depth-first searches exhibit $O(N^2)$ worst-case complexity and trigger call stack overflows on large rasters.

Terra implements an $O(N)$ **topological sort** based on cell in-degrees:

1. **In-Degree Calculation**:
   Compute the number of incoming flow connections for each cell:
   $$\operatorname{inDegree}(v) = \sum_{u \in \mathcal{N}(v)} \mathbb{I}(\operatorname{target}(u) == v)$$
2. **Queue Initialization**:
   Find all ridge-line cells (headwaters) with $\operatorname{inDegree}(u) == 0$. Push them into a FIFO processing queue.
3. **Propagation**:
   Initialize all accumulation values to $A_v = 1$ (each cell contributes its own area).
   While queue is not empty:
   - Pop cell $u$.
   - Identify its downstream target cell $v = \operatorname{target}(u)$.
   - If $v$ is valid:
     $$A_v \leftarrow A_v + A_u$$
     $$\operatorname{inDegree}(v) \leftarrow \operatorname{inDegree}(v) - 1$$
     If $\operatorname{inDegree}(v) == 0$, push $v$ into the queue.

This guarantees strictly acyclic linear-time computation without recursion.

### 3.4 Watershed Delineation

Given an arbitrary pour point (target cell $(c_p, r_p)$ selected by cursor click or stream gauge):
1. Execute a reverse Breadth-First Search (BFS) on the inverted D8 flow graph starting at $(c_p, r_p)$.
2. For each cell $u$, if $\operatorname{target}(u) == \text{current}$, label $u$ as belonging to watershed $\Omega$.
3. Compute total basin area:
   $$\operatorname{Area}(\Omega) = |\Omega| \times (\Delta x \cdot \Delta y)$$
4. Extract the boundary polygon of $\Omega$ using raster march-contouring and export as standard GeoJSON `Polygon`.

---

## 4. Computer Graphics & WebGL Rendering

Interactive 3D visualization is handled by a custom Three.js rendering subsystem designed for 60 FPS performance on consumer GPUs.

### 4.1 Adaptive Level-of-Detail (LOD) Mesh Geometry

A $2048 \times 2048$ DEM contains $4,194,304$ elevation points and $8,356,866$ triangles. Uploading millions of vertices directly to WebGL can exhaust mobile/integrated GPU memory.

Terra utilizes dynamic **Level-of-Detail (LOD) subsampling**:
$$S = \max\left(1, \left\lceil \sqrt{\frac{W \cdot H}{V_{\max}}} \right\rceil\right)$$
where $V_{\max} = 1,000,000$ vertices.

The mesh vertex grid is constructed with stride $S$:
$$col_i = i \cdot S, \quad row_j = j \cdot S$$

#### Invariant Texture & Raycasting UV Coordinates
To preserve pixel-perfect raycasting, inspection HUD queries, and profile transects, vertex UV coordinates are normalized across the full raster extent:
$$u = \frac{col_i}{W - 1}, \quad v = 1.0 - \frac{row_j}{H - 1}$$
When the user clicks the 3D surface, the intersection UV is converted back to native raster pixel coordinates:
$$col_{\text{native}} = \operatorname{clamp}(\operatorname{round}(u \cdot (W - 1)), 0, W - 1)$$
$$row_{\text{native}} = \operatorname{clamp}(\operatorname{round}((1.0 - v) \cdot (H - 1)), 0, H - 1)$$

This decouples rendering geometry complexity from full native raster resolution.

### 4.2 In-Place GPU Buffer Updates

When switching between analysis layers (Elevation $\to$ Slope $\to$ Aspect $\to$ Hillshade $\to$ Flow Accumulation) or adjusting blending parameters, Terra updates the existing Three.js `BufferAttribute` in-place:
```typescript
const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
// Populate colorAttr.array directly without reallocating vertex buffers or indices
colorAttr.needsUpdate = true;
```
This avoids WebGL geometry recompilation, VBO reallocation, and garbage collector spikes.

---

## 5. High-Performance Concurrency: Web Workers

To maintain 60 FPS UI responsiveness, all heavy raster analysis is offloaded to dedicated Web Workers via zero-copy `ArrayBuffer` transfer protocols.

```
Main UI Thread                     Dedicated Worker Thread
──────────────                     ───────────────────────
[User Loads DEM]
       │
       │ postMessage(request, [elevationBuffer])  ── Transfer ownership
       └────────────────────────────────────────> [Worker Thread]
                                                        │
                                                        │ Single-Pass Horn Kernel
                                                        │ Barnes Min-Heap Filling
                                                        │ In-Degree Topological Sort
                                                        │
[Update Progress UI] <── postMessage(progress) ────────┤ (Periodic updates)
                                                        │
[Update 3D Mesh] <── postMessage(success, [resultBuffers])
       │
[Render 60 FPS]
```

### 5.1 Fused Single-Pass Derivative Evaluation
Rather than running three independent sweeps over memory for Slope, Aspect, and Hillshade, `derivatives.worker.ts` computes all three metrics in a single cache-coherent traversal over the 3×3 moving window. This reduces memory bandwidth by $66\%$, achieving up to $16.0\text{ Mcells/s}$ throughput.

### 5.2 Zero-Copy Transferable Objects
When sending Float32Array and Uint8Array buffers between threads, Terra passes the underlying `ArrayBuffer` in the transfer list of `postMessage`:
```typescript
postMessage(response, [response.data.buffer]);
```
This instantaneously transfers memory ownership between the V8 isolates without memory copying or serialization overhead.

---

## 6. Software Architecture & Verification

Terra is structured in modular layers with strict separation between mathematical computation and presentation:

```
src/
├── app/               # React application root and state orchestrator
├── components/        # UI components (Panels, HUDs, Viewport, Transect Viewer)
├── features/
│   ├── analysis/      # Slope, aspect, hillshade, blending, profile transects
│   ├── export/        # GeoTIFF, GeoJSON, PNG, CSV export engines
│   ├── hydrology/     # Priority-Flood, D8 flow, accumulation, watershed
│   └── terrain/       # Three.js 3D viewport, adaptive geometry, camera presets
├── lib/
│   └── geospatial/    # ElevationGrid data structure, GeoTIFF loader, memory manager
├── styles/            # Cohesive scientific dark-mode CSS design system
└── workers/           # Multi-threaded Web Workers and isomorphic fallback client
```

### Testing Strategy
- **Unit Tests (`tests/`)**: Vitest test suites verifying deterministic mathematical properties (flat plains, constant slopes, pyramids, NoData boundaries, Priority-Flood sink filling, and D8 graph acyclicity).
- **Benchmark Suite (`tests/benchmarks/`)**: Automated measurement of latency and throughput ($Mcells/s$) up to 4 million cells.
- **End-to-End Tests (`tests/e2e/`)**: Playwright browser automation verifying WebGL canvas creation, dataset upload, layer switching, camera presets, and export functionality.
