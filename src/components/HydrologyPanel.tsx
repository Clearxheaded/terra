import React from 'react';
import type {
  FlowAccumulationResult,
  FlowDirectionResult,
  FlowPathPoint,
  WatershedResult,
} from '@/features/hydrology/types';

interface HydrologyPanelProps {
  isConditioned: boolean;
  onToggleConditioned: (conditioned: boolean) => void;
  flowDirResult: FlowDirectionResult | null;
  flowAccumResult: FlowAccumulationResult | null;
  streamThreshold: number;
  onStreamThresholdChange: (threshold: number) => void;
  showStreamNetwork: boolean;
  onToggleStreamNetwork: (show: boolean) => void;
  activeWatershed: WatershedResult | null;
  tracedFlowPath: readonly FlowPathPoint[] | null;
  onClearInspection: () => void;
}

export const HydrologyPanel: React.FC<HydrologyPanelProps> = ({
  isConditioned,
  onToggleConditioned,
  flowDirResult,
  flowAccumResult,
  streamThreshold,
  onStreamThresholdChange,
  showStreamNetwork,
  onToggleStreamNetwork,
  activeWatershed,
  tracedFlowPath,
  onClearInspection,
}) => {
  const maxAccum = flowAccumResult?.max ?? 1000;
  const sliderMax = Math.min(Math.max(500, Math.floor(maxAccum * 0.5)), 5000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* DEM Conditioning Mode */}
      <div className="control-group">
        <div className="control-label">
          <span>Routing Conditioning</span>
          <span className="control-value">{isConditioned ? 'Priority-Flood' : 'Raw DEM'}</span>
        </div>
        <div className="segmented-control" style={{ marginTop: '0.35rem' }}>
          <button
            type="button"
            className={`segmented-btn ${!isConditioned ? 'active' : ''}`}
            onClick={() => onToggleConditioned(false)}
          >
            Raw DEM
          </button>
          <button
            type="button"
            className={`segmented-btn ${isConditioned ? 'active' : ''}`}
            onClick={() => onToggleConditioned(true)}
          >
            Priority-Flood
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
          {isConditioned
            ? 'Barnes Priority-Flood: sinks & depression pits raised to minimum spillway.'
            : 'Raw terrain routing: flow terminates at natural pits and local depressions.'}
          {flowDirResult && (
            <div style={{ marginTop: '0.2rem' }}>
              Pits / Sinks: <strong className="monospace">{flowDirResult.pitCount}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 3D Stream Network Overlay */}
      <div className="control-group">
        <div className="toggle-row">
          <span>Drape 3D Stream Channels</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showStreamNetwork}
              onChange={(e) => onToggleStreamNetwork(e.target.checked)}
            />
            <span style={{ fontSize: '0.75rem' }}>{showStreamNetwork ? 'Visible' : 'Hidden'}</span>
          </label>
        </div>

        {showStreamNetwork && (
          <div style={{ marginTop: '0.45rem' }}>
            <div className="control-label">
              <span>Channel Threshold</span>
              <span className="control-value">{streamThreshold} cells</span>
            </div>
            <div className="slider-container">
              <input
                type="range"
                min="5"
                max={sliderMax}
                step="5"
                className="slider"
                value={streamThreshold}
                onChange={(e) => onStreamThresholdChange(Number(e.target.value))}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                marginTop: '0.2rem',
              }}
            >
              <span>5 (Dense rivulets)</span>
              <span>{sliderMax} (Major rivers)</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Pour Point & Watershed Inspection */}
      <div className="inspection-card">
        <div className="inspection-card-header">
          <span>Watershed &amp; Flow Delineation</span>
          {activeWatershed && (
            <button
              type="button"
              className="button button-sm button-ghost"
              style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}
              onClick={onClearInspection}
            >
              Clear
            </button>
          )}
        </div>

        {activeWatershed ? (
          <table className="inspection-table">
            <tbody>
              <tr>
                <td>Pour Point:</td>
                <td className="monospace">
                  [{activeWatershed.pourPoint.col}, {activeWatershed.pourPoint.row}]
                </td>
              </tr>
              {tracedFlowPath && tracedFlowPath.length > 0 && (
                <tr>
                  <td>Pour Elevation:</td>
                  <td className="monospace">{tracedFlowPath[0]!.elevation.toFixed(1)} m</td>
                </tr>
              )}
              <tr>
                <td>Contributing Area:</td>
                <td className="monospace" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {activeWatershed.areaKm2.toFixed(3)} km²
                </td>
              </tr>
              <tr>
                <td>Drainage Basin Cells:</td>
                <td className="monospace">
                  {activeWatershed.cellCount.toLocaleString()} cells ({activeWatershed.areaPercent.toFixed(1)}%)
                </td>
              </tr>
              {tracedFlowPath && (
                <tr>
                  <td>Flow Path Steps:</td>
                  <td className="monospace">
                    {tracedFlowPath.length} steps
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.45 }}>
            Click anywhere on the 3D terrain to place a pour point, delineate upstream watershed basin, and trace downstream drainage.
          </div>
        )}
      </div>
    </div>
  );
};
