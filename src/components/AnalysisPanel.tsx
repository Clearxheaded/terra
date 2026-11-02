import React from 'react';
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
  slopeUnit: SlopeUnit;
  onSlopeUnitChange: (unit: SlopeUnit) => void;
  sunAzimuth: number;
  onSunAzimuthChange: (val: number) => void;
  sunAltitude: number;
  onSunAltitudeChange: (val: number) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  grid,
  activeLayer,
  onLayerChange,
  slopeResult,
  aspectResult,
  hillshadeResult,
  slopeUnit,
  onSlopeUnitChange,
  sunAzimuth,
  onSunAzimuthChange,
  sunAltitude,
  onSunAltitudeChange,
}) => {
  const stats = grid?.getStats();

  const compassDirection = azimuthToCompass(sunAzimuth);

  return (
    <section className="sidebar-section">
      <h2 className="section-title">Terrain Analysis</h2>

      {/* Layer selector tabs */}
      <div className="layer-tabs">
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
      </div>

      {/* Interactive Legend */}
      <div className="legend-card">
        <div className="legend-header">
          <span>{activeLayer.toUpperCase()} COLOR RAMP</span>
          {activeLayer === 'slope' && (
            <span className="badge">{slopeUnit === 'degrees' ? '0° – 60°+' : '0% – 173%+'}</span>
          )}
          {activeLayer === 'aspect' && <span className="badge">Cyclic 360°</span>}
          {activeLayer === 'hillshade' && <span className="badge">0 – 255 Grayscale</span>}
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

