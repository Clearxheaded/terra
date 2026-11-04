import React, { useState } from 'react';
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
  isHiDpi?: boolean;
  onToggleHiDpi?: () => void;
}

export const TerrainHUD: React.FC<TerrainHUDProps> = ({
  hoverData,
  activeMode,
  onSetCameraPreset,
  renderStats,
  isHiDpi,
  onToggleHiDpi,
}) => {
  const [showNavGuide, setShowNavGuide] = useState(false);

  return (
    <>
      {/* 1. Top-Right: Camera Presets & HiDPI Quality Toolbar */}
      {onSetCameraPreset && (
        <div className="hud-dock-top-right">
          <div className="camera-presets-bar">
            <span className="camera-presets-label">Camera</span>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => onSetCameraPreset('top-down')}
              title="Top-Down 2D Map View (Shortcut: T)"
            >
              Top-Down
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => onSetCameraPreset('isometric')}
              title="45° Isometric View (Shortcut: I)"
            >
              45° Iso
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => onSetCameraPreset('oblique')}
              title="Oblique Perspective View (Shortcut: O)"
            >
              Oblique
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => onSetCameraPreset('default')}
              title="Reset View (Shortcut: R)"
            >
              Reset
            </button>
            {onToggleHiDpi !== undefined && (
              <button
                type="button"
                className={`camera-preset-btn ${isHiDpi ? 'retina-active' : ''}`}
                onClick={onToggleHiDpi}
                title={
                  isHiDpi
                    ? 'Active: HiDPI / Retina Sharpness. Click to switch to 1× Performance Mode'
                    : 'Active: 1× Performance Mode. Click to switch to HiDPI Retina Sharpness'
                }
              >
                {isHiDpi ? '✨ HiDPI' : '⚡ 1×'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Top-Left: Live Cursor HUD & Performance Monitor */}
      <div className="hud-dock-top-left">
        {/* Real-time WebGL Performance Stats */}
        {renderStats && (
          <div className="hud-stats-pill">
            <span
              className={`hud-fps-badge ${
                renderStats.fps >= 50 ? '' : renderStats.fps >= 30 ? 'warning' : 'danger'
              }`}
            >
              ⚡ {renderStats.fps} FPS
            </span>
            <span className="monospace">{renderStats.frameTimeMs} ms</span>
            <span className="monospace">{renderStats.triangles.toLocaleString()} tris</span>
            <span className="monospace">{renderStats.drawCalls} draws</span>
            {renderStats.lodStride > 1 && (
              <span className="hud-lod-tag">LOD {renderStats.lodStride}x</span>
            )}
          </div>
        )}

        {/* Live Terrain Inspection Card */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-title">Terrain Inspector</span>
            <div className={`hud-indicator ${hoverData ? 'active' : ''}`} />
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
                  {hoverData.crsUnit === 'degree' ? 'Coordinates' : 'Projected'}
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
                <span className="hud-label">Accumulation</span>
                <span className="hud-val monospace">
                  {hoverData.flowAccum !== undefined && hoverData.flowAccum !== null
                    ? `${Math.round(hoverData.flowAccum).toLocaleString()} cells`
                    : '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="hud-empty-state">
              Hover cursor over 3D terrain surface to inspect coordinates, elevation, slope, and drainage.
            </div>
          )}
        </div>
      </div>

      {/* 3. Center-Top: Transect Mode Notice */}
      {(activeMode === 'transect-a' || activeMode === 'transect-b') && (
        <div className="hud-dock-top-center">
          <div className="hud-mode-pill transect-mode">
            {activeMode === 'transect-a'
              ? '📍 Click 1st point on terrain to set Point A'
              : '🎯 Click 2nd point on terrain to complete profile cut (Point B)'}
          </div>
        </div>
      )}

      {/* 4. Bottom-Left: Minimal Navigation & Keyboard Shortcuts Pill */}
      <div className="hud-dock-bottom-left">
        <div className="viewport-hud">
          <div className="viewport-hud-title">
            <span>Navigation Controls</span>
            <button
              type="button"
              className="button button-ghost"
              style={{ padding: '0.05rem 0.3rem', fontSize: '0.65rem' }}
              onClick={() => setShowNavGuide((prev) => !prev)}
            >
              {showNavGuide ? 'Less' : 'More'}
            </button>
          </div>
          <div className="viewport-hud-row">
            <span>Rotate View:</span>
            <span><kbd>Left Click</kbd> + Drag</span>
          </div>
          <div className="viewport-hud-row">
            <span>Pan Ground:</span>
            <span><kbd>Right Click</kbd> + Drag</span>
          </div>
          <div className="viewport-hud-row">
            <span>Zoom:</span>
            <span><kbd>Scroll</kbd></span>
          </div>

          {showNavGuide && (
            <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.35rem' }}>
              <div className="viewport-hud-row">
                <span>Layers:</span>
                <span><kbd>1</kbd>–<kbd>6</kbd></span>
              </div>
              <div className="viewport-hud-row">
                <span>Presets:</span>
                <span><kbd>T</kbd> / <kbd>I</kbd> / <kbd>O</kbd></span>
              </div>
              <div className="viewport-hud-row">
                <span>Reset Camera:</span>
                <span><kbd>R</kbd></span>
              </div>
              <div className="viewport-hud-row">
                <span>Profile Transect:</span>
                <span><kbd>P</kbd></span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.35rem', color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 600 }}>
            {activeMode === 'transect-a'
              ? '📍 Click terrain to set Point A'
              : activeMode === 'transect-b'
                ? '🎯 Click terrain to set Point B'
                : '🎯 Click surface to delineate watershed'}
          </div>
        </div>
      </div>
    </>
  );
};
