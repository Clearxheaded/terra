import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AnalysisLayerType } from '@/features/analysis/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import {
  buildTerrainGeometry,
  createTerrainMesh,
  updateTerrainGeometryColors,
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
    layerData?: Float32Array | null
  ): void {
    this.clearCurrentMesh();

    const { geometry } = buildTerrainGeometry(grid, {
      worldSize: 100,
      wireframe: this.wireframe,
      layer,
      layerData,
    });

    this.currentGeometry = geometry;
    this.currentMesh = createTerrainMesh(geometry, { wireframe: this.wireframe });
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
    layerData?: Float32Array | null
  ): void {
    if (!this.currentGeometry) return;
    updateTerrainGeometryColors(this.currentGeometry, grid, layer, layerData);
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
