import React, { useEffect, useRef } from 'react';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { TerrainViewer } from './terrain-viewer';

interface TerrainViewportProps {
  grid: ElevationGrid | null;
  verticalExaggeration: number;
  wireframe: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  resetCameraTrigger: number;
}

export const TerrainViewport: React.FC<TerrainViewportProps> = ({
  grid,
  verticalExaggeration,
  wireframe,
  isLoading,
  errorMessage,
  resetCameraTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<TerrainViewer | null>(null);

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
    viewerRef.current.loadGrid(grid);
  }, [grid]);

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

  return (
    <main className="app-viewport">
      <div ref={containerRef} className="viewport-canvas-container" />

      {/* Navigation hints HUD */}
      <div className="viewport-hud">
        <div><strong>Left Click + Drag:</strong> Rotate</div>
        <div><strong>Right Click + Drag:</strong> Pan</div>
        <div><strong>Scroll Wheel:</strong> Zoom</div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Processing digital elevation model...
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

