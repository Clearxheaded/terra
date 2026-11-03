import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ProfilePoint } from '@/features/analysis/profile';
import type { AnalysisLayerType } from '@/features/analysis/types';
import type { FlowPathPoint } from '@/features/hydrology/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import {
  buildFlowPathGeometry,
  buildProfileTransectGeometry,
  buildStreamLinesGeometry,
  buildTerrainGeometry,
  createTerrainMesh,
  gridCoordToWorld,
  updateTerrainGeometryColors,
  type LayerBlendOptions,
  type TerrainGeometryData,
} from './terrain-mesh';

export interface TerrainViewerOptions {
  container: HTMLElement;
  initialExaggeration?: number;
}

export interface WebGLRenderStats {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  geometriesCount: number;
  texturesCount: number;
  lodStride: number;
}

export class TerrainViewer {
  private readonly container: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;

  private sunLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  private currentMesh: THREE.Mesh | null = null;
  private currentGeometry: THREE.BufferGeometry | null = null;
  private currentGeomData: TerrainGeometryData | null = null;

  // Hydrology 3D vector overlays
  private streamMesh: THREE.LineSegments | null = null;
  private flowPathMesh: THREE.Line | null = null;
  private pourPointMesh: THREE.Mesh | null = null;

  // Elevation Profile 3D vector overlays
  private transectMesh: THREE.Line | null = null;
  private transectStartMesh: THREE.Mesh | null = null;
  private transectEndMesh: THREE.Mesh | null = null;
  private profileScrubberMesh: THREE.Mesh | null = null;

  private animationFrameId: number | null = null;
  private isDisposed = false;

  private verticalExaggeration = 1.0;
  private wireframe = false;

  // Real-time WebGL performance metrics
  private lastStatsTimestamp = performance.now();
  private lastFrameTimestamp = performance.now();
  private frameCount = 0;
  private currentFps = 60;
  private currentFrameTime = 16.6;
  private onStatsUpdate?: (stats: WebGLRenderStats) => void;

  constructor(options: TerrainViewerOptions) {
    this.container = options.container;
    this.verticalExaggeration = options.initialExaggeration ?? 1.5;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1117');

    // Camera setup
    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
    this.camera.position.set(0, 80, 110);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going beneath ground plane
    this.controls.minDistance = 5;
    this.controls.maxDistance = 2000;

    // Lighting
    this.setupLighting();

    // Responsive sizing
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);

    // Start render loop
    this.startAnimationLoop();
  }

  private setupLighting(): void {
    // Ambient light for general visibility
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    // Primary directional light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.scene.add(this.sunLight);

    // Secondary fill light from opposite quadrant to soften deep shadows
    this.fillLight = new THREE.DirectionalLight(0x90b0d0, 0.4);
    this.scene.add(this.fillLight);

    // Default sun direction: 315° Azimuth, 45° Altitude
    this.updateSunPosition(315, 45);
  }

  /**
   * Updates Three.js directional sun light position in world space.
   * Coordinate alignment: East is +X, North is -Z, Up is +Y.
   */
  updateSunPosition(azimuthDeg: number, altitudeDeg: number): void {
    if (!this.sunLight || !this.fillLight) return;

    const degToRad = Math.PI / 180;
    const azRad = azimuthDeg * degToRad;
    const altRad = Math.max(0.01, Math.min(90, altitudeDeg)) * degToRad;

    const r = 160;
    const x = r * Math.cos(altRad) * Math.sin(azRad);
    const y = r * Math.sin(altRad);
    const z = -r * Math.cos(altRad) * Math.cos(azRad);

    this.sunLight.position.set(x, y, z);

    // Secondary fill light opposite
    this.fillLight.position.set(-x * 0.5, 40, -z * 0.5);
  }

  /**
   * Loads and displays a new ElevationGrid.
   */
  loadGrid(
    grid: ElevationGrid,
    layer: AnalysisLayerType = 'elevation',
    layerData?: Float32Array | null,
    maxLayerVal = 1.0,
    watershedMask?: Uint8Array | null,
    blendOptions?: LayerBlendOptions,
    lodOptions?: { lodStride?: number; maxVertices?: number }
  ): void {
    this.clearCurrentMesh();

    const geomData = buildTerrainGeometry(grid, {
      worldSize: 100,
      wireframe: this.wireframe,
      layer,
      layerData,
      maxLayerVal,
      watershedMask,
      blendOptions,
      lodStride: lodOptions?.lodStride,
      maxVertices: lodOptions?.maxVertices,
    });

    this.currentGeomData = geomData;
    this.currentGeometry = geomData.geometry;
    this.currentMesh = createTerrainMesh(geomData.geometry, { wireframe: this.wireframe });
    this.currentMesh.scale.set(1, this.verticalExaggeration, 1);

    this.scene.add(this.currentMesh);
    this.resetCamera();
  }

  /**
   * Updates vertex colors in-place without rebuilding geometry buffers.
   */
  updateLayerColors(
    grid: ElevationGrid,
    layer: AnalysisLayerType,
    layerData?: Float32Array | null,
    maxLayerVal = 1.0,
    watershedMask?: Uint8Array | null,
    blendOptions?: LayerBlendOptions
  ): void {
    if (!this.currentGeometry) return;
    updateTerrainGeometryColors(
      this.currentGeometry,
      grid,
      layer,
      layerData,
      maxLayerVal,
      watershedMask,
      undefined,
      blendOptions,
      this.currentGeomData?.lodStride ?? 1
    );
  }

  /**
   * Updates the 3D stream network polyline overlay.
   */
  updateStreamNetwork(
    grid: ElevationGrid | null,
    flowDir: Uint8Array | null,
    flowAccum: Float32Array | null,
    threshold: number,
    visible: boolean
  ): void {
    if (this.streamMesh) {
      if (this.currentMesh) {
        this.currentMesh.remove(this.streamMesh);
      }
      this.streamMesh.geometry.dispose();
      (this.streamMesh.material as THREE.Material).dispose();
      this.streamMesh = null;
    }

    if (!visible || !grid || !flowDir || !flowAccum || !this.currentGeomData || !this.currentMesh) {
      return;
    }

    const geom = buildStreamLinesGeometry(
      grid,
      flowDir,
      flowAccum,
      threshold,
      this.currentGeomData
    );
    if (!geom) return;

    const material = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });

    this.streamMesh = new THREE.LineSegments(geom, material);
    this.currentMesh.add(this.streamMesh);
  }

  /**
   * Updates the traced downstream flow path polyline.
   */
  updateFlowPath(grid: ElevationGrid | null, path: readonly FlowPathPoint[] | null): void {
    if (this.flowPathMesh) {
      if (this.currentMesh) {
        this.currentMesh.remove(this.flowPathMesh);
      }
      this.flowPathMesh.geometry.dispose();
      (this.flowPathMesh.material as THREE.Material).dispose();
      this.flowPathMesh = null;
    }

    if (!grid || !path || path.length < 2 || !this.currentGeomData || !this.currentMesh) {
      return;
    }

    const geom = buildFlowPathGeometry(grid, path, this.currentGeomData);
    if (!geom) return;

    const material = new THREE.LineBasicMaterial({
      color: 0xffb703,
      linewidth: 3,
      depthTest: true,
    });

    this.flowPathMesh = new THREE.Line(geom, material);
    this.currentMesh.add(this.flowPathMesh);
  }

  /**
   * Updates the 3D pour point indicator marker.
   */
  updatePourPoint(
    grid: ElevationGrid | null,
    pourPoint: { col: number; row: number } | null
  ): void {
    if (this.pourPointMesh) {
      if (this.currentMesh) {
        this.currentMesh.remove(this.pourPointMesh);
      }
      this.pourPointMesh.geometry.dispose();
      (this.pourPointMesh.material as THREE.Material).dispose();
      this.pourPointMesh = null;
    }

    if (!grid || !pourPoint || !this.currentGeomData || !this.currentMesh) {
      return;
    }

    const idx = pourPoint.row * grid.width + pourPoint.col;
    const elev = grid.data[idx];
    if (elev === undefined || grid.isNoData(elev)) return;

    const [x, y, z] = gridCoordToWorld(
      pourPoint.col,
      pourPoint.row,
      elev,
      this.currentGeomData,
      1.0
    );

    const sphereGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff3b30,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });

    this.pourPointMesh = new THREE.Mesh(sphereGeom, sphereMat);
    this.pourPointMesh.position.set(x, y, z);
    this.currentMesh.add(this.pourPointMesh);
  }

  /**
   * Updates the 3D draped elevation profile transect line and endpoint markers.
   */
  updateProfileTransect(
    points: readonly ProfilePoint[] | null,
    grid: ElevationGrid | null
  ): void {
    if (this.transectMesh) {
      if (this.currentMesh) this.currentMesh.remove(this.transectMesh);
      this.transectMesh.geometry.dispose();
      (this.transectMesh.material as THREE.Material).dispose();
      this.transectMesh = null;
    }
    if (this.transectStartMesh) {
      if (this.currentMesh) this.currentMesh.remove(this.transectStartMesh);
      this.transectStartMesh.geometry.dispose();
      (this.transectStartMesh.material as THREE.Material).dispose();
      this.transectStartMesh = null;
    }
    if (this.transectEndMesh) {
      if (this.currentMesh) this.currentMesh.remove(this.transectEndMesh);
      this.transectEndMesh.geometry.dispose();
      (this.transectEndMesh.material as THREE.Material).dispose();
      this.transectEndMesh = null;
    }

    if (!points || points.length < 2 || !this.currentGeomData || !this.currentMesh || !grid) {
      return;
    }

    const geom = buildProfileTransectGeometry(points, this.currentGeomData);
    if (!geom) return;

    const material = new THREE.LineBasicMaterial({
      color: 0xf72585,
      linewidth: 3,
      depthTest: true,
    });

    this.transectMesh = new THREE.Line(geom, material);
    this.currentMesh.add(this.transectMesh);

    // Marker for Point A (Cyan)
    const pStart = points[0]!;
    if (pStart.elevation !== null) {
      const [x1, y1, z1] = gridCoordToWorld(
        pStart.col,
        pStart.row,
        pStart.elevation,
        this.currentGeomData,
        1.0
      );
      const startGeom = new THREE.SphereGeometry(1.2, 16, 16);
      const startMat = new THREE.MeshStandardMaterial({
        color: 0x4cc9f0,
        emissive: 0x4cc9f0,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      this.transectStartMesh = new THREE.Mesh(startGeom, startMat);
      this.transectStartMesh.position.set(x1, y1, z1);
      this.currentMesh.add(this.transectStartMesh);
    }

    // Marker for Point B (Magenta)
    const pEnd = points[points.length - 1]!;
    if (pEnd.elevation !== null) {
      const [x2, y2, z2] = gridCoordToWorld(
        pEnd.col,
        pEnd.row,
        pEnd.elevation,
        this.currentGeomData,
        1.0
      );
      const endGeom = new THREE.SphereGeometry(1.2, 16, 16);
      const endMat = new THREE.MeshStandardMaterial({
        color: 0xf72585,
        emissive: 0xf72585,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      this.transectEndMesh = new THREE.Mesh(endGeom, endMat);
      this.transectEndMesh.position.set(x2, y2, z2);
      this.currentMesh.add(this.transectEndMesh);
    }
  }

  /**
   * Updates the 3D hover scrubber indicator marker along the transect.
   */
  updateProfileScrubber(point: ProfilePoint | null): void {
    if (this.profileScrubberMesh) {
      if (this.currentMesh) this.currentMesh.remove(this.profileScrubberMesh);
      this.profileScrubberMesh.geometry.dispose();
      (this.profileScrubberMesh.material as THREE.Material).dispose();
      this.profileScrubberMesh = null;
    }

    if (!point || point.elevation === null || !this.currentGeomData || !this.currentMesh) {
      return;
    }

    const [x, y, z] = gridCoordToWorld(
      point.col,
      point.row,
      point.elevation,
      this.currentGeomData,
      1.2
    );

    const geom = new THREE.SphereGeometry(1.4, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xffb703,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });

    this.profileScrubberMesh = new THREE.Mesh(geom, mat);
    this.profileScrubberMesh.position.set(x, y, z);
    this.currentMesh.add(this.profileScrubberMesh);
  }

  /**
   * Transitions camera to bookmark presets:
   * - 'top-down': 2D map view looking straight down from zenith
   * - 'isometric': 45° isometric angle
   * - 'oblique': Low-angle horizon perspective looking across the terrain
   * - 'default': Standard 3D perspective inspection angle
   */
  setCameraPreset(preset: 'top-down' | 'isometric' | 'oblique' | 'default'): void {
    if (preset === 'top-down') {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 150, 0.001); // 0.001 z-offset avoids gimbal singularity
    } else if (preset === 'isometric') {
      this.controls.target.set(0, 5, 0);
      this.camera.position.set(85, 85, 85);
    } else if (preset === 'oblique') {
      this.controls.target.set(0, 10, 0);
      this.camera.position.set(0, 18, 120);
    } else {
      this.resetCamera();
      return;
    }
    this.controls.update();
  }

  getDomCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  renderNow(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getCurrentGeomData(): TerrainGeometryData | null {
    return this.currentGeomData;
  }

  getCameraAzimuth(): number {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(dir.x, -dir.z);
  }

  calculateMetersPerPixel(): number {
    if (!this.currentGeomData) return 0;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const worldHeight = 2 * Math.tan(vFovRad / 2) * dist;
    const unitsPerPixel = worldHeight / Math.max(this.container.clientHeight, 1);
    return unitsPerPixel / this.currentGeomData.horizontalScale;
  }


  /**
   * Raycasts the 3D terrain mesh from screen coordinates to identify the clicked raster cell.
   */
  raycastTerrain(
    clientX: number,
    clientY: number,
    grid: ElevationGrid
  ): { col: number; row: number; elevation: number } | null {
    if (!this.currentMesh) return null;

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const mouse = new THREE.Vector2();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObject(this.currentMesh, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0]!;
    if (!hit.uv) return null;

    const col = Math.round(hit.uv.x * (grid.width - 1));
    const row = Math.round((1 - hit.uv.y) * (grid.height - 1));

    const clampedCol = Math.max(0, Math.min(grid.width - 1, col));
    const clampedRow = Math.max(0, Math.min(grid.height - 1, row));
    const idx = clampedRow * grid.width + clampedCol;
    const elevation = grid.data[idx]!;

    return { col: clampedCol, row: clampedRow, elevation };
  }

  /**
   * Updates vertical exaggeration factor without regenerating mesh buffers.
   */
  setVerticalExaggeration(exaggeration: number): void {
    this.verticalExaggeration = Math.max(0.1, Math.min(20, exaggeration));
    if (this.currentMesh) {
      this.currentMesh.scale.set(1, this.verticalExaggeration, 1);
    }
  }

  /**
   * Toggles wireframe rendering.
   */
  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    if (this.currentMesh && this.currentMesh.material instanceof THREE.MeshStandardMaterial) {
      this.currentMesh.material.wireframe = enabled;
    }
  }

  /**
   * Centers and repositions the camera for optimal terrain inspection.
   */
  resetCamera(): void {
    this.controls.target.set(0, 10, 0);
    this.camera.position.set(0, 85, 115);
    this.controls.update();
  }

  private clearCurrentMesh(): void {
    if (this.streamMesh) {
      this.streamMesh.geometry.dispose();
      (this.streamMesh.material as THREE.Material).dispose();
      this.streamMesh = null;
    }
    if (this.flowPathMesh) {
      this.flowPathMesh.geometry.dispose();
      (this.flowPathMesh.material as THREE.Material).dispose();
      this.flowPathMesh = null;
    }
    if (this.pourPointMesh) {
      this.pourPointMesh.geometry.dispose();
      (this.pourPointMesh.material as THREE.Material).dispose();
      this.pourPointMesh = null;
    }
    if (this.transectMesh) {
      this.transectMesh.geometry.dispose();
      (this.transectMesh.material as THREE.Material).dispose();
      this.transectMesh = null;
    }
    if (this.transectStartMesh) {
      this.transectStartMesh.geometry.dispose();
      (this.transectStartMesh.material as THREE.Material).dispose();
      this.transectStartMesh = null;
    }
    if (this.transectEndMesh) {
      this.transectEndMesh.geometry.dispose();
      (this.transectEndMesh.material as THREE.Material).dispose();
      this.transectEndMesh = null;
    }
    if (this.profileScrubberMesh) {
      this.profileScrubberMesh.geometry.dispose();
      (this.profileScrubberMesh.material as THREE.Material).dispose();
      this.profileScrubberMesh = null;
    }
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      if (this.currentMesh.material instanceof THREE.Material) {
        this.currentMesh.material.dispose();
      }
      this.currentMesh = null;
    }
    if (this.currentGeometry) {
      this.currentGeometry.dispose();
      this.currentGeometry = null;
    }
    this.currentGeomData = null;
  }

  private handleResize(): void {
    if (this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private startAnimationLoop = (): void => {
    if (this.isDisposed) return;

    const now = performance.now();
    this.currentFrameTime = Math.max(0.1, now - this.lastFrameTimestamp);
    this.lastFrameTimestamp = now;
    this.frameCount++;

    if (now - this.lastStatsTimestamp >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / Math.max(now - this.lastStatsTimestamp, 1));
      this.frameCount = 0;
      this.lastStatsTimestamp = now;

      if (this.onStatsUpdate) {
        this.onStatsUpdate(this.getRenderStats());
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.startAnimationLoop);
  };

  /**
   * Registers a callback listener for real-time WebGL rendering statistics.
   */
  public setOnStatsUpdate(callback?: (stats: WebGLRenderStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Returns current real-time WebGL rendering statistics.
   */
  public getRenderStats(): WebGLRenderStats {
    const renderInfo = this.renderer.info.render;
    const memoryInfo = this.renderer.info.memory;

    return {
      fps: this.currentFps,
      frameTimeMs: Math.round(this.currentFrameTime * 10) / 10,
      drawCalls: renderInfo.calls,
      triangles: renderInfo.triangles,
      vertices: this.currentGeomData?.vertexCount ?? 0,
      geometriesCount: memoryInfo.geometries,
      texturesCount: memoryInfo.textures,
      lodStride: this.currentGeomData?.lodStride ?? 1,
    };
  }

  /**
   * Disposes all WebGL memory, materials, geometries, and listeners.
   */
  dispose(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearCurrentMesh();

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
