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
import {
  IconCamera,
  IconDownload,
  IconFileCsv,
  IconMap,
  IconStream,
  IconTarget,
} from './common/Icons';

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
      showStatus('Viewport PNG saved');
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
      showStatus(`Exported 32-bit GeoTIFF (${activeLayer})`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportStreamsGeoJSON = () => {
    if (!grid || !flowDirData || !flowAccumData) return;
    try {
      const geojson = exportStreamsToGeoJSON(grid, flowDirData, flowAccumData, streamThreshold);
      downloadGeoJSON(geojson, `terra-streams-thresh${streamThreshold}.geojson`);
      showStatus(`Exported ${geojson.features.length} stream channels`);
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
      showStatus('Exported watershed polygon GeoJSON');
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportProfileCsv = () => {
    if (!profileResult) return;
    try {
      exportProfileToCsv(profileResult, `terra-elevation-profile.csv`);
      showStatus(`Exported ${profileResult.points.length} profile samples`);
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const hasStreams = flowDirData && flowAccumData;
  const hasWatershed = watershedMask && pourPoint;

  return (
    <div className="panel-stack">
      <h2 className="section-title">Geospatial Data Export</h2>

      {statusMessage && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <IconDownload size={13} className="text-accent" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Viewport PNG */}
      <div className="panel-subsection" style={{ borderTop: 'none', paddingTop: 0 }}>
        <div className="subsection-label" style={{ marginBottom: '0.45rem' }}>
          Rendered Viewport
        </div>
        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeScaleBar}
              onChange={(e) => setIncludeScaleBar(e.target.checked)}
            />
            <span>Scale bar</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeCompass}
              onChange={(e) => setIncludeCompass(e.target.checked)}
            />
            <span>Compass</span>
          </label>
        </div>
        <button
          type="button"
          className="button button-sm button-secondary button-full"
          onClick={handleExportPng}
          disabled={!grid}
        >
          <IconCamera size={13} />
          <span>Capture Viewport (PNG)</span>
        </button>
      </div>

      {/* Raster GeoTIFF */}
      <div className="panel-subsection">
        <div className="subsection-label" style={{ marginBottom: '0.45rem' }}>
          Raster Output
        </div>
        <button
          type="button"
          className="button button-sm button-secondary button-full"
          onClick={handleExportGeoTIFF}
          disabled={!grid}
          title="Encode active raster layer into 32-bit floating point GeoTIFF"
        >
          <IconMap size={13} />
          <span>Export Active Layer (GeoTIFF)</span>
        </button>
        <p className="panel-helper-text">
          Active: <strong className="monospace">{activeLayer}</strong> (Float32)
        </p>
      </div>

      {/* Vector GeoJSON */}
      <div className="panel-subsection">
        <div className="subsection-label" style={{ marginBottom: '0.45rem' }}>
          Vector Hydrology
        </div>
        <div className="stack-sm">
          <button
            type="button"
            className="button button-sm button-secondary button-full"
            onClick={handleExportStreamsGeoJSON}
            disabled={!hasStreams}
            title="Export drainage channels as GeoJSON LineStrings"
          >
            <IconStream size={13} />
            <span>Export Streams (GeoJSON)</span>
          </button>

          <button
            type="button"
            className="button button-sm button-secondary button-full"
            onClick={handleExportWatershedGeoJSON}
            disabled={!hasWatershed}
            title="Export delineated watershed basin as GeoJSON Polygon"
          >
            <IconTarget size={13} />
            <span>Export Watershed (GeoJSON)</span>
          </button>
        </div>
      </div>

      {/* Elevation Profile CSV */}
      {profileResult && (
        <div className="panel-subsection">
          <div className="subsection-label" style={{ marginBottom: '0.45rem' }}>
            Transect Table
          </div>
          <button
            type="button"
            className="button button-sm button-secondary button-full"
            onClick={handleExportProfileCsv}
            title="Download sampled transect points with elevation, distance, and slope"
          >
            <IconFileCsv size={13} />
            <span>Export Profile (CSV)</span>
          </button>
        </div>
      )}
    </div>
  );
};
