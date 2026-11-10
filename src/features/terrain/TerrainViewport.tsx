import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ProfilePoint, ProfileResult } from '@/features/analysis/profile';
import type { AnalysisLayerType, AspectResult, SlopeResult } from '@/features/analysis/types';
import { azimuthToCompass } from '@/features/analysis/aspect';
import { TerrainHUD, type TerrainHoverData } from '@/components/TerrainHUD';
import type { FlowPathPoint } from '@/features/hydrology/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import type { LayerBlendOptions } from './terrain-mesh';
import { TerrainViewer, type WebGLRenderStats } from './terrain-viewer';

export interface TerrainViewportProps {
  grid: ElevationGrid | null;
  activeLayer: AnalysisLayerType;
  activeLayerData: Float32Array | null;
  maxLayerVal?: number;
  watershedMask?: Uint8Array | null;
  blendOptions?: LayerBlendOptions;
  sunAzimuth: number;
  sunAltitude: number;
  verticalExaggeration: number;
  wireframe: boolean;
  showGrid?: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  resetCameraTrigger: number;
  cameraPresetTrigger?: {
    preset: 'top-down' | 'isometric' | 'oblique' | 'default';
    id: number;
  } | null;
  // Hydrology 3D overlay props
  showStreamNetwork?: boolean;
  streamThreshold?: number;
  flowDirData?: Uint8Array | null;
  flowAccumData?: Float32Array | null;
  tracedFlowPath?: readonly FlowPathPoint[] | null;
  pourPoint?: { col: number; row: number } | null;
  onSelectPourPoint?: (point: { col: number; row: number; elevation: number }) => void;
  // Profile props
  activeMode?: 'inspect' | 'transect-a' | 'transect-b';
  onTransectPointA?: (point: { col: number; row: number; elevation: number }) => void;
  onTransectPointB?: (point: { col: number; row: number; elevation: number }) => void;
  profileResult?: ProfileResult | null;
  hoveredProfilePoint?: ProfilePoint | null;
  // Results for HUD
  slopeResult?: SlopeResult | null;
  aspectResult?: AspectResult | null;
  viewerRefOut?: React.MutableRefObject<TerrainViewer | null>;
  onSetCameraPreset?: (preset: 'top-down' | 'isometric' | 'oblique' | 'default') => void;
  isHiDpi?: boolean;
  onToggleHiDpi?: () => void;
}

export const TerrainViewport: React.FC<TerrainViewportProps> = ({
  grid,
  activeLayer,
  activeLayerData,
  maxLayerVal = 1.0,
  watershedMask = null,
  blendOptions,
  sunAzimuth,
  sunAltitude,
  verticalExaggeration,
  wireframe,
  showGrid = true,
  isLoading,
  errorMessage,
  resetCameraTrigger,
  cameraPresetTrigger,
  showStreamNetwork = false,
  streamThreshold = 100,
  flowDirData = null,
  flowAccumData = null,
  tracedFlowPath = null,
  pourPoint = null,
  onSelectPourPoint,
  activeMode = 'inspect',
  onTransectPointA,
  onTransectPointB,
  profileResult = null,
  hoveredProfilePoint = null,
  slopeResult = null,
  aspectResult = null,
  viewerRefOut,
  onSetCameraPreset,
  isHiDpi = true,
  onToggleHiDpi,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<TerrainViewer | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const [hoverData, setHoverData] = useState<TerrainHoverData | null>(null);
  const [renderStats, setRenderStats] = useState<WebGLRenderStats | null>(null);

  // Initialize Three.js scene viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new TerrainViewer({
      container: containerRef.current,
      initialExaggeration: verticalExaggeration,
      initialHiDpi: isHiDpi,
    });
    viewer.setOnStatsUpdate((stats) => {
      setRenderStats(stats);
    });
    viewerRef.current = viewer;
    if (viewerRefOut) {
      viewerRefOut.current = viewer;
    }

    return () => {
      viewer.dispose();
      viewerRef.current = null;
      if (viewerRefOut) {
        viewerRefOut.current = null;
      }
    };
  }, [viewerRefOut]);

  // Update grid when changed
  useEffect(() => {
    if (!viewerRef.current || !grid) return;
    viewerRef.current.loadGrid(
      grid,
      activeLayer,
      activeLayerData,
      maxLayerVal,
      watershedMask,
      blendOptions
    );
  }, [grid]);

  // Update layer colors in-place
  useEffect(() => {
    if (!viewerRef.current || !grid) return;
    viewerRef.current.updateLayerColors(
      grid,
      activeLayer,
      activeLayerData,
      maxLayerVal,
      watershedMask,
      blendOptions
    );
  }, [grid, activeLayer, activeLayerData, maxLayerVal, watershedMask, blendOptions]);

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

  // Update 3D elevation profile transect line
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updateProfileTransect(profileResult?.points ?? null, grid);
  }, [grid, profileResult]);

  // Update 3D hover scrubber marker along transect
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.updateProfileScrubber(hoveredProfilePoint);
  }, [hoveredProfilePoint]);

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

  // Update HiDPI resolution mode
  useEffect(() => {
    if (!viewerRef.current || isHiDpi === undefined) return;
    viewerRef.current.setHiDpi(isHiDpi);
  }, [isHiDpi]);

  // Update wireframe mode
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setWireframe(wireframe);
  }, [wireframe]);

  // Update datum reference grid visibility
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setShowGrid(showGrid);
  }, [showGrid]);

  // Reset camera trigger
  useEffect(() => {
    if (!viewerRef.current || resetCameraTrigger === 0) return;
    viewerRef.current.resetCamera();
  }, [resetCameraTrigger]);

  // Camera preset trigger
  useEffect(() => {
    if (!viewerRef.current || !cameraPresetTrigger) return;
    viewerRef.current.setCameraPreset(cameraPresetTrigger.preset);
  }, [cameraPresetTrigger]);

  // Pointer event tracking for click vs orbit drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !viewerRef.current || !grid) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);

    // If mouse moved less than 5px, treat as click
    if (dx < 5 && dy < 5) {
      const hit = viewerRef.current.raycastTerrain(e.clientX, e.clientY, grid);
      if (hit) {
        if (activeMode === 'transect-a') {
          onTransectPointA?.(hit);
        } else if (activeMode === 'transect-b') {
          onTransectPointB?.(hit);
        } else if (onSelectPourPoint) {
          onSelectPourPoint(hit);
        }
      }
    }
    pointerStartRef.current = null;
  };

  // Live mouse hover inspection
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!viewerRef.current || !grid) return;

      const hit = viewerRef.current.raycastTerrain(e.clientX, e.clientY, grid);
      if (!hit) {
        setHoverData(null);
        return;
      }

      const { col, row, elevation } = hit;
      const idx = row * grid.width + col;
      const [geoX, geoY] = grid.gridToGeo(col, row, true);

      // Slope
      let slopeDeg: number | null = null;
      let slopePercent: number | null = null;
      if (slopeResult && slopeResult.data[idx] !== undefined) {
        const val = slopeResult.data[idx]!;
        if (slopeResult.unit === 'degrees') {
          slopeDeg = val;
          slopePercent = Math.tan((val * Math.PI) / 180) * 100;
        } else {
          slopePercent = val;
          slopeDeg = (Math.atan(val / 100) * 180) / Math.PI;
        }
      }

      // Aspect
      let aspectDeg: number | null = null;
      let aspectCardinal: string | null = null;
      if (aspectResult && aspectResult.data[idx] !== undefined) {
        const val = aspectResult.data[idx]!;
        aspectDeg = val;
        aspectCardinal = azimuthToCompass(val);
      }

      // Flow Accumulation
      let flowAccum: number | null = null;
      if (flowAccumData && flowAccumData[idx] !== undefined) {
        flowAccum = flowAccumData[idx]!;
      }

      setHoverData({
        col,
        row,
        geoX,
        geoY,
        elevation,
        slopeDeg,
        slopePercent,
        aspectDeg,
        aspectCardinal,
        flowAccum,
        crsUnit: grid.crs.unit,
        isProjected: grid.crs.isProjected,
      });
    },
    [grid, slopeResult, aspectResult, flowAccumData]
  );

  const handlePointerLeave = () => {
    setHoverData(null);
  };

  const cursorStyle =
    activeMode === 'transect-a' || activeMode === 'transect-b'
      ? 'crosshair'
      : onSelectPourPoint
        ? 'crosshair'
        : 'default';

  return (
    <main
      className="app-viewport"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ cursor: cursorStyle }}
    >
      <div ref={containerRef} className="viewport-canvas-container" />

      {/* Real-time Coordinate & Terrain HUD + Camera Presets */}
      <TerrainHUD
        grid={grid}
        hoverData={hoverData}
        activeMode={activeMode}
        onSetCameraPreset={onSetCameraPreset}
        renderStats={renderStats}
        isHiDpi={isHiDpi}
        onToggleHiDpi={onToggleHiDpi}
        viewerRef={viewerRef}
      />

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
