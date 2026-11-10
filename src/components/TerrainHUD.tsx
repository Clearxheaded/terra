import React, { useEffect, useRef, useState } from 'react';
import type { WebGLRenderStats, TerrainViewer } from '@/features/terrain/terrain-viewer';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { CompassWidget } from './CompassWidget';
import { IconCrosshair, IconGrid, IconHelpCircle, IconTarget } from './common/Icons';

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
  grid: ElevationGrid | null;
  hoverData: TerrainHoverData | null;
  activeMode?: 'inspect' | 'transect-a' | 'transect-b';
  onSetCameraPreset?: (preset: 'top-down' | 'isometric' | 'oblique' | 'default') => void;
  renderStats?: WebGLRenderStats | null;
  isHiDpi?: boolean;
  onToggleHiDpi?: () => void;
  viewerRef?: React.RefObject<TerrainViewer | null>;
}

const NICE_SCALE_METERS = [
  10, 20, 25, 50, 100, 200, 250, 500,
  1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000,
];

function computeScaleBar(metersPerPixel: number): { widthPx: number; label: string } | null {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;
  const targetWidthPx = 88;
  const rawMeters = metersPerPixel * targetWidthPx;

  let bestMeters = NICE_SCALE_METERS[0]!;
  let minDiff = Infinity;
  for (const m of NICE_SCALE_METERS) {
    const px = m / metersPerPixel;
    if (px >= 42 && px <= 130) {
      const diff = Math.abs(px - targetWidthPx);
      if (diff < minDiff) {
        minDiff = diff;
        bestMeters = m;
      }
    }
  }
  if (minDiff === Infinity) {
    bestMeters = NICE_SCALE_METERS.reduce((prev, curr) =>
      Math.abs(curr - rawMeters) < Math.abs(prev - rawMeters) ? curr : prev
    );
  }

  const widthPx = Math.max(36, Math.min(140, Math.round(bestMeters / metersPerPixel)));
  const label = bestMeters >= 1000 ? `${bestMeters / 1000} km` : `${bestMeters} m`;
  return { widthPx, label };
}

export const TerrainHUD: React.FC<TerrainHUDProps> = ({
  grid,
  hoverData,
  activeMode,
  onSetCameraPreset,
  renderStats,
  isHiDpi,
  onToggleHiDpi,
  viewerRef,
}) => {
  const [showNavGuide, setShowNavGuide] = useState(false);
  const [scaleBar, setScaleBar] = useState<{ widthPx: number; label: string } | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  const isMetricProjected = Boolean(grid && grid.crs.isProjected && grid.crs.unit === 'meter');

  useEffect(() => {
    if (!isMetricProjected) {
      setScaleBar(null);
      return;
    }

    let animId: number;
    let lastUpdate = 0;
    const updateScale = (now: number) => {
      if (now - lastUpdate > 120 && viewerRef?.current) {
        const mpp = viewerRef.current.calculateMetersPerPixel();
        setScaleBar(computeScaleBar(mpp));
        lastUpdate = now;
      }
      animId = requestAnimationFrame(updateScale);
    };

    animId = requestAnimationFrame(updateScale);
    return () => cancelAnimationFrame(animId);
  }, [isMetricProjected, viewerRef]);

  useEffect(() => {
    if (!showNavGuide) return;
    const handleOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowNavGuide(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showNavGuide]);

  return (
    <>
      {/* Top-Right: Compact Camera & Viewport Toolbar */}
      {onSetCameraPreset && (
        <div className="hud-dock-top-right">
          <div className="camera-presets-bar">
            <CompassWidget
              viewerRef={viewerRef}
              onAlignNorth={() => onSetCameraPreset('top-down')}
            />

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

            <span className="toolbar-divider" aria-hidden="true" />

            {onToggleHiDpi !== undefined && (
              <button
                type="button"
                className={`camera-preset-btn ${isHiDpi ? 'retina-active' : ''}`}
                onClick={onToggleHiDpi}
                title={
                  isHiDpi
                    ? 'Active: HiDPI / Retina sharpness. Click to switch to 1× performance mode'
                    : 'Active: 1× performance mode. Click to switch to HiDPI sharpness'
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}
              >
                <IconGrid size={12} />
                <span>{isHiDpi ? 'HiDPI' : '1×'}</span>
              </button>
            )}

            <div className="help-popover-anchor" ref={helpRef}>
              <button
                type="button"
                className={`camera-preset-btn ${showNavGuide ? 'active' : ''}`}
                onClick={() => setShowNavGuide((prev) => !prev)}
                title="Mouse & keyboard navigation controls"
                aria-label="Navigation controls help"
                aria-expanded={showNavGuide}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <IconHelpCircle size={13} />
              </button>

              {showNavGuide && (
                <div className="viewport-help-popover">
                  <div className="viewport-help-title">Viewport Controls</div>
                  <div className="viewport-hud-row">
                    <span>Orbit</span>
                    <span><kbd>Left Drag</kbd></span>
                  </div>
                  <div className="viewport-hud-row">
                    <span>Pan</span>
                    <span><kbd>Right Drag</kbd></span>
                  </div>
                  <div className="viewport-hud-row">
                    <span>Zoom</span>
                    <span><kbd>Scroll</kbd></span>
                  </div>
                  <div className="viewport-hud-row">
                    <span>Pour point</span>
                    <span><kbd>Click</kbd></span>
                  </div>
                  <div className="viewport-help-divider" />
                  <div className="viewport-hud-row">
                    <span>Layers 1–6</span>
                    <span><kbd>1</kbd>–<kbd>6</kbd></span>
                  </div>
                  <div className="viewport-hud-row">
                    <span>Views</span>
                    <span><kbd>T</kbd> <kbd>I</kbd> <kbd>O</kbd> <kbd>R</kbd></span>
                  </div>
                  <div className="viewport-hud-row">
                    <span>Profile</span>
                    <span><kbd>P</kbd></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center-Top: Active Transect Mode Prompt */}
      {(activeMode === 'transect-a' || activeMode === 'transect-b') && (
        <div className="hud-dock-top-center">
          <div className="hud-mode-pill transect-mode">
            {activeMode === 'transect-a' ? (
              <>
                <IconCrosshair size={13} className="text-accent" />
                <span>Click terrain to set Transect Point A</span>
              </>
            ) : (
              <>
                <IconTarget size={13} className="text-sky" />
                <span>Click terrain to set Transect Point B</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Whisper-Quiet Status & Scale Bar Strip */}
      <div className="viewport-statusbar">
        <div className="statusbar-left">
          {hoverData ? (
            <div className="statusbar-readout monospace">
              <span className="readout-item">
                <span className="readout-key">Cell</span> [{hoverData.col}, {hoverData.row}]
              </span>
              <span className="readout-sep">&middot;</span>
              <span className="readout-item">
                {hoverData.crsUnit === 'degree'
                  ? `${hoverData.geoY.toFixed(4)}°, ${hoverData.geoX.toFixed(4)}°`
                  : `${Math.round(hoverData.geoX)}E, ${Math.round(hoverData.geoY)}N`}
              </span>
              <span className="readout-sep">&middot;</span>
              <span className="readout-item text-accent">
                {hoverData.elevation !== null ? `${hoverData.elevation.toFixed(1)} m` : 'NoData'}
              </span>
              {hoverData.slopeDeg !== undefined && hoverData.slopeDeg !== null && (
                <>
                  <span className="readout-sep">&middot;</span>
                  <span className="readout-item">
                    <span className="readout-key">Slope</span> {hoverData.slopeDeg.toFixed(1)}°
                  </span>
                </>
              )}
              {hoverData.aspectDeg !== undefined && hoverData.aspectDeg !== null && (
                <>
                  <span className="readout-sep">&middot;</span>
                  <span className="readout-item">
                    <span className="readout-key">Aspect</span>{' '}
                    {hoverData.aspectDeg >= 0
                      ? `${hoverData.aspectCardinal ?? ''} ${Math.round(hoverData.aspectDeg)}°`
                      : 'Flat'}
                  </span>
                </>
              )}
              {hoverData.flowAccum !== undefined && hoverData.flowAccum !== null && (
                <>
                  <span className="readout-sep">&middot;</span>
                  <span className="readout-item">
                    <span className="readout-key">Accum</span>{' '}
                    {Math.round(hoverData.flowAccum).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="statusbar-idle">
              {activeMode === 'transect-a'
                ? 'Select Point A on terrain surface'
                : activeMode === 'transect-b'
                  ? 'Select Point B on terrain surface'
                  : 'Hover terrain to inspect · Click to delineate watershed'}
            </span>
          )}
        </div>

        <div className="statusbar-right">
          {isMetricProjected && scaleBar ? (
            <div className="scale-bar-widget" title="Approximate ground scale at focal target">
              <span className="scale-bar-label monospace">{scaleBar.label}</span>
              <span
                className="scale-bar-bracket"
                style={{ width: `${scaleBar.widthPx}px` }}
                aria-hidden="true"
              />
            </div>
          ) : grid ? (
            <span className="statusbar-muted monospace">
              {grid.crs.unit === 'degree' ? 'Geographic (°)' : grid.crs.unit}
            </span>
          ) : null}

          {renderStats && (
            <span className="statusbar-muted monospace">
              {renderStats.fps} fps &middot; {(renderStats.triangles / 1000).toFixed(1)}k tris
            </span>
          )}
        </div>
      </div>
    </>
  );
};
