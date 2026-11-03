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
    <section className="sidebar-section">
      <h2 className="section-title">Hydrological Analysis</h2>

      {/* DEM Conditioning Mode */}
      <div className="control-group">
        <div className="control-label">
          <span>Surface Routing Conditioning</span>
          <span className="badge">{isConditioned ? 'Conditioned' : 'Raw DEM'}</span>
        </div>
        <div className="button-group" style={{ marginTop: '0.4rem' }}>
          <button
            type="button"
            className={`button ${!isConditioned ? 'active' : ''}`}
            style={{
              flex: 1,
              background: !isConditioned ? 'var(--accent-primary)' : undefined,
              color: !isConditioned ? '#fff' : undefined,
            }}
            onClick={() => onToggleConditioned(false)}
          >
            Raw DEM
          </button>
          <button
            type="button"
            className={`button ${isConditioned ? 'active' : ''}`}
            style={{
              flex: 1,
              background: isConditioned ? 'var(--accent-primary)' : undefined,
              color: isConditioned ? '#fff' : undefined,
            }}
            onClick={() => onToggleConditioned(true)}
          >
            Priority-Flood
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {isConditioned
            ? 'Barnes Priority-Flood filled all depression pits to minimum spillway elevation.'
            : 'Raw terrain routing: flow stops at natural sinks, pits, and local depressions.'}
        </div>
      </div>

      {/* 3D Stream Network Overlay */}
      <div className="control-group" style={{ marginTop: '0.9rem' }}>
        <div className="toggle-row">
          <span>Drape 3D Stream Channels</span>
          <input
            type="checkbox"
            checked={showStreamNetwork}
            onChange={(e) => onToggleStreamNetwork(e.target.checked)}
            style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
          />
        </div>

        {showStreamNetwork && (
          <div style={{ marginTop: '0.5rem' }}>
            <div className="control-label">
              <span>Channel Initiation Threshold</span>
              <span className="control-value">{streamThreshold} cells</span>
            </div>
            <input
              type="range"
              min="5"
              max={sliderMax}
              step="5"
              value={streamThreshold}
              onChange={(e) => onStreamThresholdChange(Number(e.target.value))}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
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
          <span>Watershed & Flow Inspection</span>
          {activeWatershed && (
            <button
              type="button"
              className="button"
              style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
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
                <td>
                  Col {activeWatershed.pourPoint.col}, Row {activeWatershed.pourPoint.row}
                </td>
              </tr>
              {tracedFlowPath && tracedFlowPath.length > 0 && (
                <tr>
                  <td>Pour Elevation:</td>
                  <td>{tracedFlowPath[0]!.elevation.toFixed(1)} m</td>
                </tr>
              )}
              <tr>
                <td>Contributing Area:</td>
                <td style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {activeWatershed.areaKm2.toFixed(3)} km²
                </td>
              </tr>
              <tr>
                <td>Watershed Cells:</td>
                <td>
                  {activeWatershed.cellCount.toLocaleString()} ({activeWatershed.areaPercent.toFixed(1)}%)
                </td>
              </tr>
              {tracedFlowPath && (
                <tr>
                  <td>Downstream Path:</td>
                  <td style={{ color: '#f59e0b' }}>
                    {tracedFlowPath.length} steps to outlet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            🎯 Click any point on the 3D terrain to delineate its contributing watershed basin and trace downstream water flow.
          </div>
        )}
      </div>

      {/* Hydrology Statistics */}
      {flowAccumResult && flowDirResult && (
        <div className="stats-grid" style={{ marginTop: '0.85rem' }}>
          <div className="stat-card">
            <div className="stat-label">Max Accumulation</div>
            <div className="stat-value">{flowAccumResult.max.toLocaleString()}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>cells</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Natural Pits / Sinks</div>
            <div className="stat-value">{flowDirResult.pitCount}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {isConditioned ? '0 interior pits' : 'unconditioned'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

