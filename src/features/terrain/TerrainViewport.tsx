import React, { useEffect, useRef } from 'react';
import type { AnalysisLayerType } from '@/features/analysis/types';
import type { FlowPathPoint } from '@/features/hydrology/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { TerrainViewer } from './terrain-viewer';

interface TerrainViewportProps {
  grid: ElevationGrid | null;
  activeLayer: AnalysisLayerType;
  activeLayerData: Float32Array | null;
  maxLayerVal?: number;
  watershedMask?: Uint8Array | null;
  sunAzimuth: number;
  sunAltitude: number;
  verticalExaggeration: number;
  wireframe: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  resetCameraTrigger: number;
  // Hydrology 3D overlay props
  showStreamNetwork?: boolean;
  streamThreshold?: number;
  flowDirData?: Uint8Array | null;
  flowAccumData?: Float32Array | null;
  tracedFlowPath?: readonly FlowPathPoint[] | null;
  pourPoint?: { col: number; row: number } | null;
  onSelectPourPoint?: (point: { col: number; row: number; elevation: number }) => void;
}

export const TerrainViewport: React.FC<TerrainViewportProps> = ({
  grid,
  activeLayer,
  activeLayerData,
  maxLayerVal = 1.0,
  watershedMask = null,
  sunAzimuth,
  sunAltitude,
  verticalExaggeration,
  wireframe,
  isLoading,
  errorMessage,
  resetCameraTrigger,
  showStreamNetwork = false,
  streamThreshold = 100,
  flowDirData = null,
  flowAccumData = null,
  tracedFlowPath = null,
  pourPoint = null,
  onSelectPourPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<TerrainViewer | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize Three.js scene viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new TerrainViewer({
      container: containerRef.current,
      initialExaggeration: verticalExaggeration,
    });
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Update grid when changed
  useEffect(() => {
    if (!viewerRef.current || !grid) return;
    viewerRef.current.loadGrid(grid, activeLayer, activeLayerData, maxLayerVal, watershedMask);
  }, [grid]);

  // Update layer colors in-place
  useEffect(() => {
    if (!viewerRef.current || !grid) return;
    viewerRef.current.updateLayerColors(
      grid,
      activeLayer,
      activeLayerData,
      maxLayerVal,
      watershedMask
    );
  }, [grid, activeLayer, activeLayerData, maxLayerVal, watershedMask]);

  // Update stream network vector overlay
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updateStreamNetwork(
      grid,
      flowDirData,
      flowAccumData,
      streamThreshold,
      showStreamNetwork
    );
  }, [grid, flowDirData, flowAccumData, streamThreshold, showStreamNetwork]);

  // Update traced flow path overlay
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updateFlowPath(grid, tracedFlowPath);
  }, [grid, tracedFlowPath]);

  // Update pour point marker
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updatePourPoint(grid, pourPoint);
  }, [grid, pourPoint]);

  // Update sun position in 3D scene
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updateSunPosition(sunAzimuth, sunAltitude);
  }, [sunAzimuth, sunAltitude]);

  // Update vertical exaggeration without regenerating geometry
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setVerticalExaggeration(verticalExaggeration);
  }, [verticalExaggeration]);

  // Update wireframe mode
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setWireframe(wireframe);
  }, [wireframe]);

  // Reset camera trigger
  useEffect(() => {
    if (!viewerRef.current || resetCameraTrigger === 0) return;
    viewerRef.current.resetCamera();
  }, [resetCameraTrigger]);

  // Pointer event tracking for click vs orbit drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !viewerRef.current || !grid || !onSelectPourPoint) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);

    // If mouse moved less than 5px, treat as click rather than camera drag
    if (dx < 5 && dy < 5) {
      const hit = viewerRef.current.raycastTerrain(e.clientX, e.clientY, grid);
      if (hit) {
        onSelectPourPoint(hit);
      }
    }
    pointerStartRef.current = null;
  };

  return (
    <main
      className="app-viewport"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{ cursor: onSelectPourPoint ? 'crosshair' : 'default' }}
    >
      <div ref={containerRef} className="viewport-canvas-container" />

      {/* Navigation & Inspection hints HUD */}
      <div className="viewport-hud">
        <div><strong>Left Click + Drag:</strong> Rotate</div>
        <div><strong>Right Click + Drag:</strong> Pan</div>
        <div><strong>Scroll Wheel:</strong> Zoom</div>
        <div style={{ marginTop: '0.35rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          🎯 Click terrain surface to inspect pour point & delineate watershed
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Processing digital elevation model & hydrological routing...
          </p>
        </div>
      )}

      {/* Error display */}
      {errorMessage && (
        <div
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            maxWidth: '380px',
            zIndex: 40,
          }}
        >
          <div className="alert alert-danger">
            <strong>DEM Import Error:</strong>
            <div style={{ marginTop: '0.25rem' }}>{errorMessage}</div>
          </div>
        </div>
      )}
    </main>
  );
};
