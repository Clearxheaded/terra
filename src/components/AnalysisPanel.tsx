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

interface LayerItemDef {
  id: AnalysisLayerType;
  label: string;
  sublabel: string;
  shortcut: string;
  gradientClass: string;
}

const LAYER_DEFS: LayerItemDef[] = [
  {
    id: 'elevation',
    label: 'Elevation',
    sublabel: 'Hypsometric',
    shortcut: '1',
    gradientClass: 'legend-bar-elevation',
  },
  {
    id: 'slope',
    label: 'Slope',
    sublabel: "Horn 3×3",
    shortcut: '2',
    gradientClass: 'legend-bar-slope',
  },
  {
    id: 'aspect',
    label: 'Aspect',
    sublabel: 'Azimuth',
    shortcut: '3',
    gradientClass: 'legend-bar-aspect',
  },
  {
    id: 'hillshade',
    label: 'Hillshade',
    sublabel: 'Lambertian',
    shortcut: '4',
    gradientClass: 'legend-bar-hillshade',
  },
  {
    id: 'd8-flow',
    label: 'D8 Flow',
    sublabel: 'Direction',
    shortcut: '5',
    gradientClass: 'legend-bar-d8-flow',
  },
  {
    id: 'flow-accumulation',
    label: 'Accum',
    sublabel: 'Drainage area',
    shortcut: '6',
    gradientClass: 'legend-bar-flow-accumulation',
  },
];

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
    <div className="panel-stack">
      {/* Surface Layer Selector */}
      <div>
        <div className="section-title">
          <span>Surface Layer</span>
          <span className="section-hint">Keys 1–6</span>
        </div>

        <div className="layer-list" role="radiogroup" aria-label="Surface analysis layer">
          {LAYER_DEFS.map((layer) => {
            const isActive = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`layer-tab ${isActive ? 'active' : ''}`}
                onClick={() => onLayerChange(layer.id)}
              >
                <span className="layer-tab-chip">
                  <span className={`layer-ramp-swatch ${layer.gradientClass}`} />
                </span>
                <span className="layer-tab-label">{layer.label}</span>
                <span className="layer-tab-sublabel">{layer.sublabel}</span>
                <kbd className="layer-tab-key">{layer.shortcut}</kbd>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Color Ramp Legend */}
      <div className="legend-card">
        <div className="legend-header">
          <span>{activeLayer.replace('-', ' ')} scale</span>
          {activeLayer === 'slope' && <span className="monospace">{slopeUnit}</span>}
        </div>

        {activeLayer === 'elevation' && (
          <>
            <div className="legend-bar legend-bar-elevation" />
            <div className="legend-labels">
              <span>{stats ? `${Math.round(stats.min)}m` : 'Low'}</span>
              <span>{stats ? `${Math.round((stats.min + stats.max) / 2)}m` : 'Mid'}</span>
              <span>{stats ? `${Math.round(stats.max)}m` : 'High'}</span>
            </div>
          </>
        )}

        {activeLayer === 'slope' && (
          <>
            <div className="legend-bar legend-bar-slope" />
            <div className="legend-labels">
              <span>0{slopeUnit === 'degrees' ? '°' : '%'}</span>
              <span>{slopeUnit === 'degrees' ? '45°' : '100%'}</span>
              <span>{slopeUnit === 'degrees' ? '90°' : '200%+'}</span>
            </div>
          </>
        )}

        {activeLayer === 'aspect' && (
          <>
            <div className="legend-bar legend-bar-aspect" />
            <div className="legend-labels">
              <span>N</span>
              <span>E</span>
              <span>S</span>
              <span>W</span>
              <span>N</span>
            </div>
          </>
        )}

        {activeLayer === 'hillshade' && (
          <>
            <div className="legend-bar legend-bar-hillshade" />
            <div className="legend-labels">
              <span>0</span>
              <span>128</span>
              <span>255</span>
            </div>
          </>
        )}

        {activeLayer === 'd8-flow' && (
          <>
            <div className="legend-bar legend-bar-d8-flow" />
            <div className="legend-labels">
              <span>E</span>
              <span>SE</span>
              <span>S</span>
              <span>SW</span>
              <span>W</span>
              <span>NW</span>
              <span>N</span>
              <span>NE</span>
            </div>
          </>
        )}

        {activeLayer === 'flow-accumulation' && (
          <>
            <div className="legend-bar legend-bar-flow-accumulation" />
            <div className="legend-labels">
              <span>1</span>
              <span>100</span>
              <span>{flowAccumMax ? Math.round(flowAccumMax).toLocaleString() : 'Max'}</span>
            </div>
          </>
        )}
      </div>

      {/* Contextual Layer Parameters */}
      {activeLayer === 'slope' && (
        <div className="control-block">
          <div className="control-label">
            <span>Slope unit</span>
          </div>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${slopeUnit === 'degrees' ? 'active' : ''}`}
              onClick={() => onSlopeUnitChange('degrees')}
            >
              Degrees (0–90°)
            </button>
            <button
              type="button"
              className={`segmented-btn ${slopeUnit === 'percent' ? 'active' : ''}`}
              onClick={() => onSlopeUnitChange('percent')}
            >
              Percent (%)
            </button>
          </div>
          {slopeResult && (
            <div className="inline-stat-row">
              <span>
                Mean{' '}
                <strong className="monospace">
                  {slopeResult.mean.toFixed(1)}
                  {slopeUnit === 'degrees' ? '°' : '%'}
                </strong>
              </span>
              <span>
                Max{' '}
                <strong className="monospace">
                  {slopeResult.max.toFixed(1)}
                  {slopeUnit === 'degrees' ? '°' : '%'}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

      {activeLayer === 'aspect' && aspectResult && (
        <div className="control-block">
          <div className="inline-stat-row">
            <span>
              Flat cells <strong className="monospace">{aspectResult.flatCount.toLocaleString()}</strong>
            </span>
            <span>
              Sloped{' '}
              <strong className="monospace">
                {(aspectResult.data.length - aspectResult.flatCount).toLocaleString()}
              </strong>
            </span>
          </div>
        </div>
      )}

      {activeLayer === 'hillshade' && (
        <div className="control-block">
          <div className="control-group">
            <div className="control-label">
              <span>Sun azimuth</span>
              <span className="control-value">
                {sunAzimuth}° {compassDirection}
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
              <span>Sun altitude</span>
              <span className="control-value">{sunAltitude}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              className="slider"
              value={sunAltitude}
              onChange={(e) => onSunAltitudeChange(parseInt(e.target.value, 10))}
            />
          </div>

          {hillshadeResult && (
            <div className="inline-stat-row">
              <span>
                Min <strong className="monospace">{hillshadeResult.min}</strong>
              </span>
              <span>
                Max <strong className="monospace">{hillshadeResult.max}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Multi-Layer Compositing */}
      {onToggleBlending && (
        <div className="panel-subsection">
          <div className="toggle-row">
            <span className="subsection-label">Layer compositing</span>
            <div className="segmented-control" style={{ width: '92px' }}>
              <button
                type="button"
                className={`segmented-btn ${!isBlendingEnabled ? 'active' : ''}`}
                onClick={() => onToggleBlending(false)}
              >
                Off
              </button>
              <button
                type="button"
                className={`segmented-btn ${isBlendingEnabled ? 'active' : ''}`}
                onClick={() => onToggleBlending(true)}
              >
                On
              </button>
            </div>
          </div>

          {isBlendingEnabled && (
            <div className="blend-controls">
              <div className="form-row">
                <span className="form-row-label">Base</span>
                <select
                  value={baseLayer}
                  onChange={(e) => onBaseLayerChange?.(e.target.value as BaseLayerType)}
                  className="dropdown-select"
                >
                  <option value="elevation">Elevation</option>
                  <option value="hillshade">Hillshade</option>
                </select>
              </div>

              <div className="form-row">
                <span className="form-row-label">Overlay</span>
                <select
                  value={overlayLayer}
                  onChange={(e) => onOverlayLayerChange?.(e.target.value as OverlayLayerType)}
                  className="dropdown-select"
                >
                  <option value="none">None</option>
                  <option value="slope">Slope</option>
                  <option value="aspect">Aspect</option>
                  <option value="hillshade">Hillshade</option>
                  <option value="d8-flow">D8 Flow</option>
                  <option value="flow-accumulation">Accumulation</option>
                </select>
              </div>

              <div className="form-row">
                <span className="form-row-label">Blend</span>
                <select
                  value={blendMode}
                  onChange={(e) => onBlendModeChange?.(e.target.value as BlendMode)}
                  className="dropdown-select"
                >
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                  <option value="normal">Normal</option>
                </select>
              </div>

              <div className="control-group" style={{ marginBottom: 0 }}>
                <div className="control-label">
                  <span>Opacity</span>
                  <span className="control-value">{Math.round(overlayOpacity * 100)}%</span>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
