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
import {
  IconCompass,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconMountain,
  IconSlope,
  IconStream,
  IconSun,
} from './common/Icons';

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
  icon: React.ReactNode;
  gradientClass: string;
}

const LAYER_DEFS: LayerItemDef[] = [
  {
    id: 'elevation',
    label: 'Elevation',
    sublabel: 'Hypsometric tint',
    shortcut: '1',
    icon: <IconMountain size={15} />,
    gradientClass: 'legend-bar-elevation',
  },
  {
    id: 'slope',
    label: 'Slope',
    sublabel: "Horn's gradient",
    shortcut: '2',
    icon: <IconSlope size={15} />,
    gradientClass: 'legend-bar-slope',
  },
  {
    id: 'aspect',
    label: 'Aspect',
    sublabel: 'Compass azimuth',
    shortcut: '3',
    icon: <IconCompass size={15} />,
    gradientClass: 'legend-bar-aspect',
  },
  {
    id: 'hillshade',
    label: 'Hillshade',
    sublabel: 'Solar reflectance',
    shortcut: '4',
    icon: <IconSun size={15} />,
    gradientClass: 'legend-bar-hillshade',
  },
  {
    id: 'd8-flow',
    label: 'D8 Flow',
    sublabel: 'Steepest descent',
    shortcut: '5',
    icon: <IconDroplet size={15} />,
    gradientClass: 'legend-bar-d8-flow',
  },
  {
    id: 'flow-accumulation',
    label: 'Accum',
    sublabel: 'Drainage area',
    shortcut: '6',
    icon: <IconStream size={15} />,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Kepler.gl Inspired Layer Manager Stack */}
      <div>
        <div className="section-title">
          <span>Surface Layer Stack</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            Keys 1–6
          </span>
        </div>

        <div className="kepler-layer-stack">
          {LAYER_DEFS.map((layer) => {
            const isActive = activeLayer === layer.id;
            return (
              <div
                key={layer.id}
                className={`kepler-layer-row ${isActive ? 'active' : ''}`}
                onClick={() => onLayerChange(layer.id)}
              >
                {/* Visibility Toggle Button */}
                <button
                  type="button"
                  className="layer-visibility-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerChange(layer.id);
                  }}
                  title={isActive ? 'Active layer' : `Switch to ${layer.label}`}
                >
                  {isActive ? (
                    <IconEye size={15} className="text-emerald" />
                  ) : (
                    <IconEyeOff size={15} className="text-muted" />
                  )}
                </button>

                {/* Layer tab button for test compatibility and clean semantics */}
                <button
                  type="button"
                  className={`layer-tab ${isActive ? 'active' : ''}`}
                  onClick={() => onLayerChange(layer.id)}
                >
                  <span className="layer-tab-chip">
                    <span className={`layer-ramp-swatch ${layer.gradientClass}`} />
                  </span>
                  <span className="layer-tab-icon">{layer.icon}</span>
                  <div className="layer-tab-info">
                    <span className="layer-tab-label">{layer.label}</span>
                    <span className="layer-tab-sublabel">{layer.sublabel}</span>
                  </div>
                  <span className="layer-tab-badge">{layer.shortcut}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Layer Color Ramp Legend */}
      <div className="legend-card">
        <div className="legend-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
              {activeLayer.replace('-', ' ')}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Legend</span>
          </div>
          {activeLayer === 'slope' && (
            <span className="control-value">{slopeUnit}</span>
          )}
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
              <span>N (0°)</span>
              <span>E (90°)</span>
              <span>S (180°)</span>
              <span>W (270°)</span>
              <span>N (360°)</span>
            </div>
          </>
        )}

        {activeLayer === 'hillshade' && (
          <>
            <div className="legend-bar legend-bar-hillshade" />
            <div className="legend-labels">
              <span>0 (Shadow)</span>
              <span>128 (Neutral)</span>
              <span>255 (Illuminated)</span>
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
              <span>1 (Ridge)</span>
              <span>100 (Stream)</span>
              <span>
                {flowAccumMax ? `${Math.round(flowAccumMax).toLocaleString()} (River)` : 'Max'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Layer-Specific Parameter Controls */}
      {activeLayer === 'slope' && (
        <div className="control-group">
          <div className="control-label">
            <span>Slope Measurement Unit</span>
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
            <div
              style={{
                marginTop: '0.5rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.35rem',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Mean:{' '}
                <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                  {slopeResult.mean.toFixed(1)}
                  {slopeUnit === 'degrees' ? '°' : '%'}
                </strong>
              </div>
              <div>
                Max:{' '}
                <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                  {slopeResult.max.toFixed(1)}
                  {slopeUnit === 'degrees' ? '°' : '%'}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {activeLayer === 'aspect' && aspectResult && (
        <div className="control-group">
          <div className="section-title">Aspect Surface Summary</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.35rem',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Flat cells:{' '}
              <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                {aspectResult.flatCount.toLocaleString()}
              </strong>
            </div>
            <div>
              Valid slopes:{' '}
              <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                {(aspectResult.data.length - aspectResult.flatCount).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

      {activeLayer === 'hillshade' && (
        <div>
          <div className="control-group">
            <div className="control-label">
              <span>Sun Azimuth</span>
              <span className="control-value">
                {sunAzimuth}° ({compassDirection})
              </span>
            </div>
            <div className="slider-container">
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
          </div>

          <div className="control-group">
            <div className="control-label">
              <span>Sun Altitude</span>
              <span className="control-value">{sunAltitude}°</span>
            </div>
            <div className="slider-container">
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
          </div>

          {hillshadeResult && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.35rem',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Min Shade:{' '}
                <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                  {hillshadeResult.min}
                </strong>
              </div>
              <div>
                Max Shade:{' '}
                <strong className="monospace" style={{ color: 'var(--text-primary)' }}>
                  {hillshadeResult.max}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kepler.gl Multi-Layer Blending Stack */}
      {onToggleBlending && (
        <div className="inspection-card" style={{ marginTop: '0.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Multi-Layer Blending</span>
            <div className="segmented-control" style={{ width: '100px' }}>
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
            <div
              style={{
                marginTop: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Base Layer:</span>
                <select
                  value={baseLayer}
                  onChange={(e) => onBaseLayerChange?.(e.target.value as BaseLayerType)}
                  className="dropdown-select"
                  style={{ width: '135px' }}
                >
                  <option value="elevation">Elevation</option>
                  <option value="hillshade">Hillshade</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Overlay Layer:</span>
                <select
                  value={overlayLayer}
                  onChange={(e) => onOverlayLayerChange?.(e.target.value as OverlayLayerType)}
                  className="dropdown-select"
                  style={{ width: '135px' }}
                >
                  <option value="none">None</option>
                  <option value="slope">Slope</option>
                  <option value="aspect">Aspect</option>
                  <option value="hillshade">Hillshade</option>
                  <option value="d8-flow">D8 Flow</option>
                  <option value="flow-accumulation">Accumulation</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Blend Mode:</span>
                <select
                  value={blendMode}
                  onChange={(e) => onBlendModeChange?.(e.target.value as BlendMode)}
                  className="dropdown-select"
                  style={{ width: '135px' }}
                >
                  <option value="multiply">Multiply (Shading)</option>
                  <option value="screen">Screen (Lighten)</option>
                  <option value="overlay">Overlay (Contrast)</option>
                  <option value="normal">Normal (Alpha Blend)</option>
                </select>
              </div>

              <div style={{ marginTop: '0.2rem' }}>
                <div className="control-label">
                  <span>Overlay Opacity</span>
                  <span className="control-value">{Math.round(overlayOpacity * 100)}%</span>
                </div>
                <div className="slider-container">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
