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
    <div className="panel-stack">
      {/* DEM Conditioning Mode */}
      <div className="control-block">
        <div className="control-label">
          <span>DEM conditioning</span>
          {flowDirResult && (
            <span className="control-value">{flowDirResult.pitCount} sinks</span>
          )}
        </div>
        <div className="segmented-control">
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
        <p className="panel-helper-text">
          {isConditioned
            ? 'Barnes Priority-Flood fills sinks to minimum spillway elevation for continuous routing.'
            : 'Unconditioned routing terminates flow inside local terrain depressions.'}
        </p>
      </div>

      {/* 3D Stream Network Overlay */}
      <div className="panel-subsection">
        <div className="toggle-row">
          <span className="subsection-label">3D stream channels</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showStreamNetwork}
              onChange={(e) => onToggleStreamNetwork(e.target.checked)}
            />
            <span>{showStreamNetwork ? 'On' : 'Off'}</span>
          </label>
        </div>

        {showStreamNetwork && (
          <div style={{ marginTop: '0.6rem' }}>
            <div className="control-label">
              <span>Accumulation threshold</span>
              <span className="control-value">{streamThreshold} cells</span>
            </div>
            <input
              type="range"
              min="5"
              max={sliderMax}
              step="5"
              className="slider"
              value={streamThreshold}
              onChange={(e) => onStreamThresholdChange(Number(e.target.value))}
            />
            <div className="range-scale-labels">
              <span>5 (Dense)</span>
              <span>{sliderMax} (Major)</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Pour Point & Watershed Inspection */}
      <div className="panel-subsection">
        <div className="subsection-header">
          <span className="subsection-label">Watershed delineation</span>
          {activeWatershed && (
            <button
              type="button"
              className="button button-sm button-ghost"
              onClick={onClearInspection}
            >
              Clear
            </button>
          )}
        </div>

        {activeWatershed ? (
          <table className="spec-table">
            <tbody>
              <tr>
                <td>Pour point</td>
                <td className="monospace">
                  [{activeWatershed.pourPoint.col}, {activeWatershed.pourPoint.row}]
                </td>
              </tr>
              {tracedFlowPath && tracedFlowPath.length > 0 && (
                <tr>
                  <td>Pour elevation</td>
                  <td className="monospace">{tracedFlowPath[0]!.elevation.toFixed(1)} m</td>
                </tr>
              )}
              <tr>
                <td>Contributing area</td>
                <td className="monospace text-accent" style={{ fontWeight: 600 }}>
                  {activeWatershed.areaKm2.toFixed(3)} km²
                </td>
              </tr>
              <tr>
                <td>Basin cells</td>
                <td className="monospace">
                  {activeWatershed.cellCount.toLocaleString()} ({activeWatershed.areaPercent.toFixed(1)}%)
                </td>
              </tr>
              {tracedFlowPath && (
                <tr>
                  <td>Downstream path</td>
                  <td className="monospace">{tracedFlowPath.length} steps</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p className="panel-helper-text">
            Click any cell on the 3D terrain mesh to place a pour point and trace its upstream basin and downstream flow path.
          </p>
        )}
      </div>
    </div>
  );
};
