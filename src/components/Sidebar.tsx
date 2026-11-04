import React, { useRef } from 'react';
import type { BaseLayerType, BlendMode, OverlayLayerType } from '@/features/analysis/blending';
import type { ProfileResult } from '@/features/analysis/profile';
import type {
  AnalysisLayerType,
  AspectResult,
  HillshadeResult,
  SlopeResult,
  SlopeUnit,
} from '@/features/analysis/types';
import type { TerrainViewer } from '@/features/terrain/terrain-viewer';
import type {
  FlowAccumulationResult,
  FlowDirectionResult,
  FlowPathPoint,
  WatershedResult,
} from '@/features/hydrology/types';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import type { SyntheticTerrainOptions } from '@/lib/geospatial/synthetic-terrain';
import { AnalysisPanel } from './AnalysisPanel';
import { ExportPanel } from './ExportPanel';
import { HydrologyPanel } from './HydrologyPanel';

interface SidebarProps {
  grid: ElevationGrid | null;
  viewerRef: React.RefObject<TerrainViewer | null>;
  warnings: string[];
  activeLayer: AnalysisLayerType;
  onLayerChange: (layer: AnalysisLayerType) => void;
  activeLayerData: Float32Array | null;
  slopeResult: SlopeResult | null;
  aspectResult: AspectResult | null;
  hillshadeResult: HillshadeResult | null;
  slopeUnit: SlopeUnit;
  onSlopeUnitChange: (unit: SlopeUnit) => void;
  sunAzimuth: number;
  onSunAzimuthChange: (val: number) => void;
  sunAltitude: number;
  onSunAltitudeChange: (val: number) => void;
  verticalExaggeration: number;
  onVerticalExaggerationChange: (val: number) => void;
  wireframe: boolean;
  onWireframeChange: (val: boolean) => void;
  // Multi-layer blending props
  isBlendingEnabled: boolean;
  onToggleBlending: (enabled: boolean) => void;
  baseLayer: BaseLayerType;
  onBaseLayerChange: (base: BaseLayerType) => void;
  overlayLayer: OverlayLayerType;
  onOverlayLayerChange: (overlay: OverlayLayerType) => void;
  overlayOpacity: number;
  onOverlayOpacityChange: (opacity: number) => void;
  blendMode: BlendMode;
  onBlendModeChange: (mode: BlendMode) => void;
  // Elevation Profile props
  activeMode: 'inspect' | 'transect-a' | 'transect-b';
  onStartTransect: () => void;
  onCancelTransect: () => void;
  profileResult: ProfileResult | null;
  isProfileOpen: boolean;
  onToggleProfileOpen: (open: boolean) => void;
  onClearProfile: () => void;
  // Camera presets
  onSetCameraPreset: (preset: 'top-down' | 'isometric' | 'oblique' | 'default') => void;
  // Hydrology props
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
  pourPoint: { col: number; row: number } | null;
  onClearInspection: () => void;
  onFileUpload: (file: File) => void;
  onLoadSynthetic: (type: SyntheticTerrainOptions['type']) => void;
  onLoadSampleFile: (url?: string, title?: string) => void;
  onResetCamera: () => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  grid,
  viewerRef,
  warnings,
  activeLayer,
  onLayerChange,
  activeLayerData,
  slopeResult,
  aspectResult,
  hillshadeResult,
  slopeUnit,
  onSlopeUnitChange,
  sunAzimuth,
  onSunAzimuthChange,
  sunAltitude,
  onSunAltitudeChange,
  verticalExaggeration,
  onVerticalExaggerationChange,
  wireframe,
  onWireframeChange,
  isBlendingEnabled,
  onToggleBlending,
  baseLayer,
  onBaseLayerChange,
  overlayLayer,
  onOverlayLayerChange,
  overlayOpacity,
  onOverlayOpacityChange,
  blendMode,
  onBlendModeChange,
  activeMode,
  onStartTransect,
  onCancelTransect,
  profileResult,
  isProfileOpen,
  onToggleProfileOpen,
  onClearProfile,
  onSetCameraPreset,
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
  pourPoint,
  onClearInspection,
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
      </section>

      {/* Open Sample DEM Datasets */}
      <section className="sidebar-section">
        <h2 className="section-title">Open Sample DEMs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <button
            type="button"
            className="button"
            style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '0.45rem 0.65rem' }}
            onClick={() =>
              onLoadSampleFile('/samples/mount_st_helens.tif', 'Mount St. Helens (USGS 3DEP 30m)')
            }
            disabled={isLoading}
            data-testid="sample-mount-st-helens"
          >
            <span style={{ fontSize: '1.2rem', marginRight: '0.35rem' }}>🌋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Mount St. Helens</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>USGS 3DEP &bull; 30m UTM &bull; 128&times;128</div>
            </div>
          </button>

          <button
            type="button"
            className="button"
            style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '0.45rem 0.65rem' }}
            onClick={() =>
              onLoadSampleFile('/samples/drainage_basin.tif', 'Eagle Creek Basin (30m UTM)')
            }
            disabled={isLoading}
            data-testid="sample-drainage-basin"
          >
            <span style={{ fontSize: '1.2rem', marginRight: '0.35rem' }}>🌊</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Eagle Creek Basin</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Copernicus DEM &bull; Sinks &bull; 128&times;128</div>
            </div>
          </button>

          <button
            type="button"
            className="button"
            style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '0.45rem 0.65rem' }}
            onClick={() =>
              onLoadSampleFile('/samples/sample_dem.tif', 'Sample Volcanic Peak (30m UTM)')
            }
            disabled={isLoading}
            data-testid="sample-volcanic-peak"
          >
            <span style={{ fontSize: '1.2rem', marginRight: '0.35rem' }}>⛰️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Volcanic Peak (Light)</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Foundational &bull; 35&times;35 Grid</div>
            </div>
          </button>
        </div>
      </section>

      {/* Synthetic Models */}
      <section className="sidebar-section">
        <h2 className="section-title">Synthetic Terrains</h2>
        <div className="button-group">
          <button type="button" className="button" onClick={() => onLoadSynthetic('mountain')}>
            Mountain
          </button>
          <button type="button" className="button" onClick={() => onLoadSynthetic('valley')}>
            Valley
          </button>
          <button type="button" className="button" onClick={() => onLoadSynthetic('pyramid')}>
            Pyramid
          </button>
          <button type="button" className="button" onClick={() => onLoadSynthetic('plane')}>
            Plane
          </button>
          <button type="button" className="button" onClick={() => onLoadSynthetic('depression')}>
            Depression
          </button>
        </div>
      </section>

      {/* Terrain Analysis Layer & Blending Controls */}
      <AnalysisPanel
        grid={grid}
        activeLayer={activeLayer}
        onLayerChange={onLayerChange}
        slopeResult={slopeResult}
        aspectResult={aspectResult}
        hillshadeResult={hillshadeResult}
        flowAccumMax={flowAccumResult?.max}
        slopeUnit={slopeUnit}
        onSlopeUnitChange={onSlopeUnitChange}
        sunAzimuth={sunAzimuth}
        onSunAzimuthChange={onSunAzimuthChange}
        sunAltitude={sunAltitude}
        onSunAltitudeChange={onSunAltitudeChange}
        isBlendingEnabled={isBlendingEnabled}
        onToggleBlending={onToggleBlending}
        baseLayer={baseLayer}
        onBaseLayerChange={onBaseLayerChange}
        overlayLayer={overlayLayer}
        onOverlayLayerChange={onOverlayLayerChange}
        overlayOpacity={overlayOpacity}
        onOverlayOpacityChange={onOverlayOpacityChange}
        blendMode={blendMode}
        onBlendModeChange={onBlendModeChange}
      />

      {/* Topographic Profile Transect Tool */}
      <section className="sidebar-section">
        <h2 className="section-title">Elevation Profile Transect</h2>

        {activeMode === 'transect-a' || activeMode === 'transect-b' ? (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="alert alert-info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              {activeMode === 'transect-a'
                ? '📍 Click 1st point on 3D terrain to start transect (Point A)'
                : '🎯 Click 2nd point on 3D terrain to finish cut (Point B)'}
            </div>
            <button
              type="button"
              className="button button-sm button-ghost"
              style={{ width: '100%' }}
              onClick={onCancelTransect}
            >
              Cancel Transect
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="button button-sm button-primary"
              style={{ width: '100%', marginBottom: '0.5rem' }}
              onClick={onStartTransect}
              disabled={!grid}
            >
              📏 Draw 2D Profile Transect
            </button>
          </div>
        )}

        {profileResult && (
          <div style={{ background: 'var(--surface-color)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Active Profile</span>
              <span className="badge badge-primary">{profileResult.points.length} samples</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginBottom: '0.6rem' }}>
              <div>Dist: <strong>{(profileResult.totalHorizontalDistance / 1000).toFixed(2)} km</strong></div>
              <div>Span: <strong>{Math.round(profileResult.minElevation)}–{Math.round(profileResult.maxElevation)}m</strong></div>
              <div>Gain: <strong style={{ color: 'var(--accent-primary)' }}>+{Math.round(profileResult.elevationGain)}m</strong></div>
              <div>Loss: <strong style={{ color: 'var(--accent-danger)' }}>-{Math.round(profileResult.elevationLoss)}m</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="button button-sm button-secondary"
                style={{ flex: 1 }}
                onClick={() => onToggleProfileOpen(!isProfileOpen)}
              >
                {isProfileOpen ? 'Hide Chart' : 'Show Chart'}
              </button>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={onClearProfile}
                title="Clear current profile transect"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Hydrology Workspace Controls */}
      <HydrologyPanel
        isConditioned={isConditioned}
        onToggleConditioned={onToggleConditioned}
        flowDirResult={flowDirResult}
        flowAccumResult={flowAccumResult}
        streamThreshold={streamThreshold}
        onStreamThresholdChange={onStreamThresholdChange}
        showStreamNetwork={showStreamNetwork}
        onToggleStreamNetwork={onToggleStreamNetwork}
        activeWatershed={activeWatershed}
        tracedFlowPath={tracedFlowPath}
        onClearInspection={onClearInspection}
      />

      {/* 3D Visualization Controls */}
      <section className="sidebar-section">
        <h2 className="section-title">3D Visualization</h2>

        <div className="control-group" style={{ marginBottom: '0.85rem' }}>
          <div className="control-label" style={{ marginBottom: '0.35rem' }}>
            <span>Camera Bookmarks</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => onSetCameraPreset('top-down')}
              title="Orthographic Top-Down 2D Map View"
            >
              🗺️ Top-Down
            </button>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => onSetCameraPreset('isometric')}
              title="45° Isometric Perspective View"
            >
              📐 45° Isometric
            </button>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => onSetCameraPreset('oblique')}
              title="Low-Angle Horizon Oblique Perspective"
            >
              🌅 Oblique
            </button>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={() => onSetCameraPreset('default')}
              title="Reset Default Orbit Perspective"
            >
              🔄 Default View
            </button>
          </div>
        </div>

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

        <button type="button" className="button" style={{ width: '100%' }} onClick={onResetCamera}>
          Reset Camera View
        </button>
      </section>

      {/* Geospatial Export Suite */}
      <ExportPanel
        grid={grid}
        viewerRef={viewerRef}
        activeLayer={activeLayer}
        activeLayerData={activeLayerData}
        flowDirData={flowDirResult?.data ?? null}
        flowAccumData={flowAccumResult?.data ?? null}
        streamThreshold={streamThreshold}
        watershedMask={activeWatershed?.mask ?? null}
        pourPoint={pourPoint}
        watershedAreaKm2={activeWatershed?.areaKm2}
        profileResult={profileResult}
      />

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
