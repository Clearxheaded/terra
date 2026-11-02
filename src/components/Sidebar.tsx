import React, { useRef } from 'react';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import type { SyntheticTerrainOptions } from '@/lib/geospatial/synthetic-terrain';

interface SidebarProps {
  grid: ElevationGrid | null;
  warnings: string[];
  verticalExaggeration: number;
  onVerticalExaggerationChange: (val: number) => void;
  wireframe: boolean;
  onWireframeChange: (val: boolean) => void;
  onFileUpload: (file: File) => void;
  onLoadSynthetic: (type: SyntheticTerrainOptions['type']) => void;
  onLoadSampleFile: () => void;
  onResetCamera: () => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  grid,
  warnings,
  verticalExaggeration,
  onVerticalExaggerationChange,
  wireframe,
  onWireframeChange,
  onFileUpload,
  onLoadSynthetic,
  onLoadSampleFile,
  onResetCamera,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stats = grid?.getStats();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset input value so the same file can be reloaded if selected again
      e.target.value = '';
    }
  };

  return (
    <aside className="app-sidebar">
      {/* Import Section */}
      <section className="sidebar-section">
        <h2 className="section-title">Import DEM</h2>

        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".tif,.tiff,.geotiff"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>📁</div>
          <div className="upload-dropzone-text">Select GeoTIFF File</div>
          <div className="upload-dropzone-hint">.tif, .tiff local DEM files (client-side)</div>
        </div>

        <div style={{ marginTop: '0.85rem' }}>
          <button
            className="button"
            style={{ width: '100%', marginBottom: '0.5rem' }}
            onClick={onLoadSampleFile}
            disabled={isLoading}
          >
            Load Sample GeoTIFF (30m)
          </button>
        </div>
      </section>

      {/* Synthetic Models */}
      <section className="sidebar-section">
        <h2 className="section-title">Synthetic Terrains</h2>
        <div className="button-group">
          <button className="button" onClick={() => onLoadSynthetic('mountain')}>
            Mountain
          </button>
          <button className="button" onClick={() => onLoadSynthetic('valley')}>
            Valley
          </button>
          <button className="button" onClick={() => onLoadSynthetic('pyramid')}>
            Pyramid
          </button>
          <button className="button" onClick={() => onLoadSynthetic('plane')}>
            Plane
          </button>
          <button className="button" onClick={() => onLoadSynthetic('depression')}>
            Depression
          </button>
        </div>
      </section>

      {/* 3D Visualization Controls */}
      <section className="sidebar-section">
        <h2 className="section-title">3D Visualization</h2>

        <div className="control-group">
          <div className="control-label">
            <span>Vertical Exaggeration</span>
            <span className="control-value">{verticalExaggeration.toFixed(1)}&times;</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            className="slider"
            value={verticalExaggeration}
            onChange={(e) => onVerticalExaggerationChange(parseFloat(e.target.value))}
          />
        </div>

        <div className="control-group" style={{ marginBottom: '1rem' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => onWireframeChange(e.target.checked)}
            />
            <span>Show Mesh Wireframe</span>
          </label>
        </div>

        <button className="button" style={{ width: '100%' }} onClick={onResetCamera}>
          Reset Camera View
        </button>
      </section>

      {/* Warnings & Geospatial Integrity */}
      {warnings.length > 0 && (
        <section className="sidebar-section">
          <h2 className="section-title" style={{ color: 'var(--accent-warning)' }}>
            Dataset Notices ({warnings.length})
          </h2>
          {warnings.map((w, idx) => (
            <div key={idx} className="alert alert-warning">
              {w}
            </div>
          ))}
        </section>
      )}

      {/* Dataset Metadata Inspector */}
      {grid && stats && (
        <section className="sidebar-section">
          <h2 className="section-title">Terrain Metadata</h2>
          <div className="metadata-grid">
            <div className="meta-card">
              <div className="meta-card-label">Dimensions</div>
              <div className="meta-card-value">
                {grid.width} &times; {grid.height}
              </div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Total Cells</div>
              <div className="meta-card-value">
                {(grid.width * grid.height).toLocaleString()}
              </div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Pixel X (Res)</div>
              <div className="meta-card-value">{grid.pixelSizeX.toFixed(2)}</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Pixel Y (Res)</div>
              <div className="meta-card-value">{grid.pixelSizeY.toFixed(2)}</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">CRS Unit</div>
              <div className="meta-card-value">{grid.crs.unit}</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">CRS Code</div>
              <div className="meta-card-value">{grid.crs.code ?? 'None'}</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Min Elevation</div>
              <div className="meta-card-value">{stats.min.toFixed(1)}m</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Max Elevation</div>
              <div className="meta-card-value">{stats.max.toFixed(1)}m</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">Elevation Span</div>
              <div className="meta-card-value">{(stats.max - stats.min).toFixed(1)}m</div>
            </div>
            <div className="meta-card">
              <div className="meta-card-label">NoData Cells</div>
              <div className="meta-card-value">{stats.noDataCount}</div>
            </div>
          </div>
        </section>
      )}
    </aside>
  );
};

