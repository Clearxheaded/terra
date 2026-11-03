import React from 'react';
import type { BaseLayerType, BlendMode, OverlayLayerType } from '@/features/analysis/blending';
import type {
  AnalysisLayerType,
  AspectResult,
  HillshadeResult,
  SlopeResult,
  SlopeUnit,
} from '@/features/analysis/types';
import { azimuthToCompass } from '@/features/analysis/aspect';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

interface AnalysisPanelProps {
  grid: ElevationGrid | null;
  activeLayer: AnalysisLayerType;
  onLayerChange: (layer: AnalysisLayerType) => void;
  slopeResult: SlopeResult | null;
  aspectResult: AspectResult | null;
  hillshadeResult: HillshadeResult | null;
  flowAccumMax?: number;
  slopeUnit: SlopeUnit;
  onSlopeUnitChange: (unit: SlopeUnit) => void;
  sunAzimuth: number;
  onSunAzimuthChange: (val: number) => void;
  sunAltitude: number;
  onSunAltitudeChange: (val: number) => void;
  // Multi-layer blending props
  isBlendingEnabled?: boolean;
  onToggleBlending?: (enabled: boolean) => void;
  baseLayer?: BaseLayerType;
  onBaseLayerChange?: (base: BaseLayerType) => void;
  overlayLayer?: OverlayLayerType;
  onOverlayLayerChange?: (overlay: OverlayLayerType) => void;
  overlayOpacity?: number;
  onOverlayOpacityChange?: (opacity: number) => void;
  blendMode?: BlendMode;
  onBlendModeChange?: (mode: BlendMode) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  grid,
  activeLayer,
  onLayerChange,
  slopeResult,
  aspectResult,
  hillshadeResult,
  flowAccumMax,
  slopeUnit,
  onSlopeUnitChange,
  sunAzimuth,
  onSunAzimuthChange,
  sunAltitude,
  onSunAltitudeChange,
  isBlendingEnabled = false,
  onToggleBlending,
  baseLayer = 'elevation',
  onBaseLayerChange,
  overlayLayer = 'none',
  onOverlayLayerChange,
  overlayOpacity = 0.75,
  onOverlayOpacityChange,
  blendMode = 'multiply',
  onBlendModeChange,
}) => {
  const stats = grid?.getStats();

  const compassDirection = azimuthToCompass(sunAzimuth);

  return (
    <section className="sidebar-section">
      <h2 className="section-title">Terrain Analysis</h2>

      {/* Layer selector tabs */}
      <div className="layer-tabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'elevation' ? 'active' : ''}`}
          onClick={() => onLayerChange('elevation')}
        >
          <span>⛰️</span>
          <span>Elevation</span>
        </button>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'slope' ? 'active' : ''}`}
          onClick={() => onLayerChange('slope')}
        >
          <span>📐</span>
          <span>Slope</span>
        </button>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'aspect' ? 'active' : ''}`}
          onClick={() => onLayerChange('aspect')}
        >
          <span>🧭</span>
          <span>Aspect</span>
        </button>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'hillshade' ? 'active' : ''}`}
          onClick={() => onLayerChange('hillshade')}
        >
          <span>☀️</span>
          <span>Hillshade</span>
        </button>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'd8-flow' ? 'active' : ''}`}
          onClick={() => onLayerChange('d8-flow')}
        >
          <span>💧</span>
          <span>D8 Flow</span>
        </button>
        <button
          type="button"
          className={`layer-tab ${activeLayer === 'flow-accumulation' ? 'active' : ''}`}
          onClick={() => onLayerChange('flow-accumulation')}
        >
          <span>🌊</span>
          <span>Accum</span>
        </button>
      </div>

      {/* Multi-Layer Blending Section */}
      {onToggleBlending && (
        <div className="control-group" style={{ background: 'var(--surface-color)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Multi-Layer Blending</span>
            <label className="toggle-switch" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem' }}>
              <input
                type="checkbox"
                checked={isBlendingEnabled}
                onChange={(e) => onToggleBlending(e.target.checked)}
              />
              <span>{isBlendingEnabled ? 'Active' : 'Off'}</span>
            </label>
          </div>

          {isBlendingEnabled && (
            <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Base Layer:</span>
                <select
                  value={baseLayer}
                  onChange={(e) => onBaseLayerChange?.(e.target.value as BaseLayerType)}
                  className="dropdown-select"
                  style={{ width: '130px', fontSize: '0.78rem', padding: '0.2rem 0.4rem' }}
                >
                  <option value="elevation">⛰️ Elevation</option>
                  <option value="hillshade">☀️ Hillshade</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overlay Layer:</span>
                <select
                  value={overlayLayer}
                  onChange={(e) => onOverlayLayerChange?.(e.target.value as OverlayLayerType)}
                  className="dropdown-select"
                  style={{ width: '130px', fontSize: '0.78rem', padding: '0.2rem 0.4rem' }}
                >
                  <option value="none">None</option>
                  <option value="slope">📐 Slope</option>
                  <option value="aspect">🧭 Aspect</option>
                  <option value="hillshade">☀️ Hillshade</option>
                  <option value="d8-flow">💧 D8 Flow</option>
                  <option value="flow-accumulation">🌊 Accumulation</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Blend Mode:</span>
                <select
                  value={blendMode}
                  onChange={(e) => onBlendModeChange?.(e.target.value as BlendMode)}
                  className="dropdown-select"
                  style={{ width: '130px', fontSize: '0.78rem', padding: '0.2rem 0.4rem' }}
                >
                  <option value="multiply">Multiply (Shading)</option>
                  <option value="normal">Normal (Alpha)</option>
                  <option value="overlay">Overlay</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overlay Opacity</span>
                  <span style={{ fontFamily: 'monospace' }}>{Math.round(overlayOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="slider"
                  value={overlayOpacity}
                  onChange={(e) => onOverlayOpacityChange?.(parseFloat(e.target.value))}
                />
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                💡 <em>Multiply</em> mode drapes hillshade shading over elevation/slope color ramps.
              </div>
            </div>
          )}
        </div>
      )}


      {/* Interactive Legend */}
      <div className="legend-card">
        <div className="legend-header">
          <span>{activeLayer.replace('-', ' ').toUpperCase()} COLOR RAMP</span>
          {activeLayer === 'slope' && (
            <span className="badge">{slopeUnit === 'degrees' ? '0° – 60°+' : '0% – 173%+'}</span>
          )}
          {activeLayer === 'aspect' && <span className="badge">Cyclic 360°</span>}
          {activeLayer === 'hillshade' && <span className="badge">0 – 255 Grayscale</span>}
          {activeLayer === 'd8-flow' && <span className="badge">8 Compass Directions</span>}
          {activeLayer === 'flow-accumulation' && <span className="badge">Log10 River Gradient</span>}
        </div>

        <div className={`legend-bar legend-bar-${activeLayer}`} />

        <div className="legend-labels">
          {activeLayer === 'elevation' && stats && (
            <>
              <span>{stats.min.toFixed(0)}m</span>
              <span>{((stats.min + stats.max) / 2).toFixed(0)}m</span>
              <span>{stats.max.toFixed(0)}m</span>
            </>
          )}

          {activeLayer === 'slope' && (
            <>
              <span>{slopeUnit === 'degrees' ? '0° (Flat)' : '0%'}</span>
              <span>{slopeUnit === 'degrees' ? '25°' : '47%'}</span>
              <span>{slopeUnit === 'degrees' ? '60°+ (Cliff)' : '173%+'}</span>
            </>
          )}

          {activeLayer === 'aspect' && (
            <>
              <span>N (0°)</span>
              <span>E (90°)</span>
              <span>S (180°)</span>
              <span>W (270°)</span>
              <span>N (360°)</span>
            </>
          )}

          {activeLayer === 'hillshade' && (
            <>
              <span>Shadow (0)</span>
              <span>Midtone (128)</span>
              <span>Direct (255)</span>
            </>
          )}

          {activeLayer === 'd8-flow' && (
            <>
              <span>E (1)</span>
              <span>S (4)</span>
              <span>W (16)</span>
              <span>N (64)</span>
            </>
          )}

          {activeLayer === 'flow-accumulation' && (
            <>
              <span>1 cell (Ridge)</span>
              <span>Intermediate</span>
              <span>{flowAccumMax ? `${flowAccumMax.toLocaleString()} cells` : 'River Trunk'}</span>
            </>
          )}
        </div>
      </div>

      {/* Layer-Specific Controls */}
      {activeLayer === 'slope' && (
        <div className="control-group">
          <div className="control-label">
            <span>Slope Measurement Unit</span>
            <span className="control-value">{slopeUnit}</span>
          </div>
          <div className="button-group" style={{ marginTop: '0.4rem' }}>
            <button
              type="button"
              className={`button ${slopeUnit === 'degrees' ? 'active' : ''}`}
              style={{
                flex: 1,
                background: slopeUnit === 'degrees' ? 'var(--accent-primary)' : undefined,
                color: slopeUnit === 'degrees' ? '#fff' : undefined,
              }}
              onClick={() => onSlopeUnitChange('degrees')}
            >
              Degrees (°)
            </button>
            <button
              type="button"
              className={`button ${slopeUnit === 'percent' ? 'active' : ''}`}
              style={{
                flex: 1,
                background: slopeUnit === 'percent' ? 'var(--accent-primary)' : undefined,
                color: slopeUnit === 'percent' ? '#fff' : undefined,
              }}
              onClick={() => onSlopeUnitChange('percent')}
            >
              Percent (%)
            </button>
          </div>
        </div>
      )}

      {activeLayer === 'hillshade' && (
        <>
          <div className="control-group">
            <div className="control-label">
              <span>Sun Azimuth</span>
              <span className="control-value">
                {sunAzimuth}° ({compassDirection})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              className="slider"
              value={sunAzimuth}
              onChange={(e) => onSunAzimuthChange(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span>Sun Altitude (Angle)</span>
              <span className="control-value">{sunAltitude}°</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              step="1"
              className="slider"
              value={sunAltitude}
              onChange={(e) => onSunAltitudeChange(parseInt(e.target.value, 10))}
            />
          </div>
        </>
      )}

      {/* Layer Statistical Summary */}
      {activeLayer === 'slope' && slopeResult && (
        <div className="metadata-grid" style={{ marginTop: '0.65rem' }}>
          <div className="meta-card">
            <div className="meta-card-label">Mean Slope</div>
            <div className="meta-card-value">
              {slopeResult.mean.toFixed(1)}
              {slopeUnit === 'degrees' ? '°' : '%'}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Max Slope</div>
            <div className="meta-card-value">
              {slopeResult.max.toFixed(1)}
              {slopeUnit === 'degrees' ? '°' : '%'}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Min Slope</div>
            <div className="meta-card-value">
              {slopeResult.min.toFixed(1)}
              {slopeUnit === 'degrees' ? '°' : '%'}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Valid Cells</div>
            <div className="meta-card-value">{slopeResult.validCount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {activeLayer === 'aspect' && aspectResult && (
        <div className="metadata-grid" style={{ marginTop: '0.65rem' }}>
          <div className="meta-card">
            <div className="meta-card-label">Dominant Facing</div>
            <div className="meta-card-value" title={aspectResult.dominantDirection}>
              {aspectResult.dominantDirection}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Dominant Share</div>
            <div className="meta-card-value">{aspectResult.dominantPercentage.toFixed(1)}%</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Circular Mean</div>
            <div className="meta-card-value">
              {aspectResult.circularMean !== null
                ? `${aspectResult.circularMean.toFixed(1)}°`
                : 'N/A'}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Flat Cells</div>
            <div className="meta-card-value">{aspectResult.flatCount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {activeLayer === 'hillshade' && hillshadeResult && (
        <div className="metadata-grid" style={{ marginTop: '0.65rem' }}>
          <div className="meta-card">
            <div className="meta-card-label">Mean Shading</div>
            <div className="meta-card-value">{hillshadeResult.mean.toFixed(0)} / 255</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Shade Range</div>
            <div className="meta-card-value">
              {hillshadeResult.min.toFixed(0)} – {hillshadeResult.max.toFixed(0)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

