import React, { useState } from 'react';
import type { ProfileResult } from '@/features/analysis/profile';
import type { AnalysisLayerType } from '@/features/analysis/types';
import {
  exportLayerToGeoTIFF,
  exportProfileToCsv,
  exportStreamsToGeoJSON,
  exportViewportToPng,
  exportWatershedToGeoJSON,
  downloadGeoJSON,
} from '@/features/export';
import type { TerrainViewer } from '@/features/terrain/terrain-viewer';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

interface ExportPanelProps {
  grid: ElevationGrid | null;
  viewerRef: React.RefObject<TerrainViewer | null>;
  activeLayer: AnalysisLayerType;
  activeLayerData: Float32Array | null;
  flowDirData: Uint8Array | null;
  flowAccumData: Float32Array | null;
  streamThreshold: number;
  watershedMask: Uint8Array | null;
  pourPoint: { col: number; row: number } | null;
  watershedAreaKm2?: number;
  profileResult: ProfileResult | null;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  grid,
  viewerRef,
  activeLayer,
  activeLayerData,
  flowDirData,
  flowAccumData,
  streamThreshold,
  watershedMask,
  pourPoint,
  watershedAreaKm2,
  profileResult,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [includeScaleBar, setIncludeScaleBar] = useState(true);
  const [includeCompass, setIncludeCompass] = useState(true);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleExportPng = async () => {
    if (!viewerRef.current) return;
    try {
      await exportViewportToPng(viewerRef.current, {
        filename: `terra-${grid?.datasetName ? grid.datasetName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'viewport'}.png`,
        datasetName: grid?.datasetName,
        includeScaleBar,
        includeCompass,
      });
      showStatus('📸 Viewport PNG exported successfully!');
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportGeoTIFF = () => {
    if (!grid) return;
    try {
      const dataToExport = activeLayerData ?? grid.data;
      const layerName = activeLayer.replace(/[^a-zA-Z0-9_-]/g, '_');
      exportLayerToGeoTIFF(grid, dataToExport, `terra-${layerName}.tif`);
      showStatus(`🗺️ Exported 32-bit Float GeoTIFF (${activeLayer})!`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportStreamsGeoJSON = () => {
    if (!grid || !flowDirData || !flowAccumData) return;
    try {
      const geojson = exportStreamsToGeoJSON(grid, flowDirData, flowAccumData, streamThreshold);
      downloadGeoJSON(geojson, `terra-streams-thresh${streamThreshold}.geojson`);
      showStatus(`🌊 Exported ${geojson.features.length} stream channels as GeoJSON!`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportWatershedGeoJSON = () => {
    if (!grid || !watershedMask || !pourPoint) return;
    try {
      const geojson = exportWatershedToGeoJSON(
        grid,
        watershedMask,
        pourPoint,
        watershedAreaKm2 ?? 0
      );
      downloadGeoJSON(geojson, `terra-watershed-basin.geojson`);
      showStatus(`🏞️ Exported delineated watershed boundary polygon as GeoJSON!`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportProfileCsv = () => {
    if (!profileResult) return;
    try {
      exportProfileToCsv(profileResult, `terra-elevation-profile.csv`);
      showStatus(`📈 Exported ${profileResult.points.length} profile data points as CSV!`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const hasStreams = flowDirData && flowAccumData;
  const hasWatershed = watershedMask && pourPoint;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 className="section-title">Geospatial Data Export</h2>

      {statusMessage && (
        <div className="alert alert-info" style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
          {statusMessage}
        </div>
      )}

      {/* Viewport PNG */}
      <div className="control-group" style={{ marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>High-Res Viewport Image</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.78rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeScaleBar}
              onChange={(e) => setIncludeScaleBar(e.target.checked)}
            />
            Scale Bar
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeCompass}
              onChange={(e) => setIncludeCompass(e.target.checked)}
            />
            Compass Rose
          </label>
        </div>
        <button
          type="button"
          className="button button-sm button-secondary"
          style={{ width: '100%' }}
          onClick={handleExportPng}
          disabled={!grid}
        >
          📸 Capture Viewport (PNG)
        </button>
      </div>

      {/* Raster GeoTIFF */}
      <div className="control-group" style={{ marginBottom: '0.85rem' }}>
        <button
          type="button"
          className="button button-sm button-secondary"
          style={{ width: '100%' }}
          onClick={handleExportGeoTIFF}
          disabled={!grid}
          title="Encode active raster layer into 32-bit floating point GeoTIFF"
        >
          🗺️ Export Active Layer (GeoTIFF)
        </button>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Active: <strong>{activeLayer}</strong> (32-bit float, georeferenced)
        </div>
      </div>

      {/* Vector GeoJSON */}
      <div className="control-group" style={{ marginBottom: '0.85rem' }}>
        <button
          type="button"
          className="button button-sm button-secondary"
          style={{ width: '100%', marginBottom: '0.4rem' }}
          onClick={handleExportStreamsGeoJSON}
          disabled={!hasStreams}
          title="Export drainage channels as GeoJSON LineStrings"
        >
          🌊 Export Streams (GeoJSON)
        </button>

        <button
          type="button"
          className="button button-sm button-secondary"
          style={{ width: '100%' }}
          onClick={handleExportWatershedGeoJSON}
          disabled={!hasWatershed}
          title="Export delineated watershed basin as GeoJSON Polygon"
        >
          🏞️ Export Watershed (GeoJSON)
        </button>
      </div>

      {/* Elevation Profile CSV */}
      {profileResult && (
        <div className="control-group">
          <button
            type="button"
            className="button button-sm button-secondary"
            style={{ width: '100%' }}
            onClick={handleExportProfileCsv}
            title="Download sampled transect points with elevation, distance, and slope"
          >
            📈 Export Profile (CSV)
          </button>
        </div>
      )}
    </div>
  );
};

