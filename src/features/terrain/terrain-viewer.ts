import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AnalysisLayerType } from '@/features/analysis/types';
import type { FlowPathPoint } from '@/features/hydrology/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import {
  buildFlowPathGeometry,
  buildStreamLinesGeometry,
  buildTerrainGeometry,
  createTerrainMesh,
  gridCoordToWorld,
  updateTerrainGeometryColors,
  type TerrainGeometryData,
} from './terrain-mesh';

export interface TerrainViewerOptions {
  container: HTMLElement;
  initialExaggeration?: number;
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

  private animationFrameId: number | null = null;
  private isDisposed = false;

  private verticalExaggeration = 1.0;
  private wireframe = false;

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
    watershedMask?: Uint8Array | null
  ): void {
    this.clearCurrentMesh();

    const geomData = buildTerrainGeometry(grid, {
      worldSize: 100,
      wireframe: this.wireframe,
      layer,
      layerData,
      maxLayerVal,
      watershedMask,
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
    watershedMask?: Uint8Array | null
  ): void {
    if (!this.currentGeometry) return;
    updateTerrainGeometryColors(
      this.currentGeometry,
      grid,
      layer,
      layerData,
      maxLayerVal,
      watershedMask
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

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.startAnimationLoop);
  };

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
