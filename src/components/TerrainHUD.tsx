import React from 'react';
import type { WebGLRenderStats } from '@/features/terrain/terrain-viewer';

export interface TerrainHoverData {
  col: number;
  row: number;
  geoX: number;
  geoY: number;
  elevation: number | null;
  slopeDeg?: number | null;
  slopePercent?: number | null;
  aspectDeg?: number | null;
  aspectCardinal?: string | null;
  flowAccum?: number | null;
  crsUnit: string;
  isProjected?: boolean;
}

interface TerrainHUDProps {
  hoverData: TerrainHoverData | null;
  activeMode?: 'inspect' | 'transect-a' | 'transect-b';
  onSetCameraPreset?: (preset: 'top-down' | 'isometric' | 'oblique' | 'default') => void;
  renderStats?: WebGLRenderStats | null;
}

export const TerrainHUD: React.FC<TerrainHUDProps> = ({
  hoverData,
  activeMode,
  onSetCameraPreset,
  renderStats,
}) => {
  return (
    <div className="terrain-hud-container">
      {/* Top Camera Bookmark Bar */}
      {onSetCameraPreset && (
        <div className="camera-presets-bar">
          <span className="camera-presets-label">Camera:</span>
          <button
            type="button"
            className="camera-preset-btn"
            onClick={() => onSetCameraPreset('top-down')}
            title="Orthographic Top-Down 2D Map View"
          >
            🗺️ Top-Down
          </button>
          <button
            type="button"
            className="camera-preset-btn"
            onClick={() => onSetCameraPreset('isometric')}
            title="45° Isometric Perspective"
          >
            📐 45° Iso
          </button>
          <button
            type="button"
            className="camera-preset-btn"
            onClick={() => onSetCameraPreset('oblique')}
            title="Low-Angle Horizon Oblique Perspective"
          >
            🌅 Oblique
          </button>
          <button
            type="button"
            className="camera-preset-btn"
            onClick={() => onSetCameraPreset('default')}
            title="Reset to Default Perspective"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* Real-time WebGL Performance Stats Pill */}
      {renderStats && (
        <div className="hud-stats-pill">
          <span
            className={`hud-fps-badge ${
              renderStats.fps >= 50 ? '' : renderStats.fps >= 30 ? 'warning' : 'danger'
            }`}
          >
            ⚡ {renderStats.fps} FPS
          </span>
          <span>{renderStats.frameTimeMs} ms</span>
          <span>🔺 {renderStats.triangles.toLocaleString()} tris</span>
          <span>📦 {renderStats.drawCalls} draws</span>
          {renderStats.lodStride > 1 && (
            <span className="hud-lod-tag">LOD {renderStats.lodStride}x</span>
          )}
        </div>
      )}

      {/* Mode Status Pill */}
      {activeMode === 'transect-a' && (
        <div className="hud-mode-pill transect-mode">
          📍 Click 1st point on terrain to start profile transect (Point A)
        </div>
      )}
      {activeMode === 'transect-b' && (
        <div className="hud-mode-pill transect-mode">
          🎯 Click 2nd point on terrain to complete profile cut (Point B)
        </div>
      )}

      {/* Live Inspection Card */}
      <div className="hud-card">
        <div className="hud-card-header">
          <div className="hud-indicator active" />
          <span className="hud-title">Live Terrain Cursor HUD</span>
        </div>

        {hoverData ? (
          <div className="hud-grid">
            <div className="hud-item">
              <span className="hud-label">Raster Cell</span>
              <span className="hud-val monospace">
                [{hoverData.col}, {hoverData.row}]
              </span>
            </div>

            <div className="hud-item">
              <span className="hud-label">
                {hoverData.crsUnit === 'degree' ? 'Coordinates (Lat/Lon)' : 'Projected (E/N)'}
              </span>
              <span className="hud-val monospace">
                {hoverData.crsUnit === 'degree'
                  ? `${hoverData.geoY.toFixed(4)}°, ${hoverData.geoX.toFixed(4)}°`
                  : `${Math.round(hoverData.geoX)}m, ${Math.round(hoverData.geoY)}m`}
              </span>
            </div>

            <div className="hud-item">
              <span className="hud-label">Elevation</span>
              <span className="hud-val monospace highlight-elev">
                {hoverData.elevation !== null
                  ? `${hoverData.elevation.toFixed(1)} m (${(hoverData.elevation * 3.28084).toFixed(0)} ft)`
                  : 'NoData'}
              </span>
            </div>

            <div className="hud-item">
              <span className="hud-label">Slope</span>
              <span className="hud-val monospace">
                {hoverData.slopeDeg !== undefined && hoverData.slopeDeg !== null
                  ? `${hoverData.slopeDeg.toFixed(1)}° (${hoverData.slopePercent?.toFixed(1) ?? '—'}%)`
                  : '—'}
              </span>
            </div>

            <div className="hud-item">
              <span className="hud-label">Aspect</span>
              <span className="hud-val monospace">
                {hoverData.aspectDeg !== undefined && hoverData.aspectDeg !== null
                  ? `${hoverData.aspectCardinal ?? ''} ${hoverData.aspectDeg >= 0 ? `${Math.round(hoverData.aspectDeg)}°` : 'Flat'}`
                  : '—'}
              </span>
            </div>

            <div className="hud-item">
              <span className="hud-label">Flow Accumulation</span>
              <span className="hud-val monospace">
                {hoverData.flowAccum !== undefined && hoverData.flowAccum !== null
                  ? `${Math.round(hoverData.flowAccum).toLocaleString()} cells`
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="hud-empty-state">
            Hover cursor over terrain surface to inspect real-time coordinates, elevation, slope, and drainage.
          </div>
        )}
      </div>
    </div>
  );
};

