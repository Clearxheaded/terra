import React, { useRef, useState } from 'react';
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
import {
  IconChevronRight,
  IconCrosshair,
  IconCube,
  IconDownload,
  IconDroplet,
  IconFolderUp,
  IconHorizon,
  IconLayers,
  IconMap,
  IconPanelLeft,
  IconRotateCcw,
  IconRuler,
  IconTarget,
} from './common/Icons';
import { ExportPanel } from './ExportPanel';
import { HydrologyPanel } from './HydrologyPanel';

export type WorkbenchTab = 'layers' | 'hydro' | 'profile' | 'data' | 'scene' | 'export';

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
  showGrid: boolean;
  onShowGridChange: (val: boolean) => void;
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
  activeMode: 'inspect' | 'transect-a' | 'transect-b';
  onStartTransect: () => void;
  onCancelTransect: () => void;
  profileResult: ProfileResult | null;
  isProfileOpen: boolean;
  onToggleProfileOpen: (open: boolean) => void;
  onClearProfile: () => void;
  onSetCameraPreset: (preset: 'top-down' | 'isometric' | 'oblique' | 'default') => void;
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

const TAB_TITLES: Record<WorkbenchTab, string> = {
  layers: 'Surface Layers',
  hydro: 'Hydrology & Drainage',
  profile: 'Elevation Profile',
  data: 'Data & Metadata',
  scene: '3D Scene & Camera',
  export: 'Export Data',
};

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
  showGrid,
  onShowGridChange,
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

  const [activeTab, setActiveTab] = useState<WorkbenchTab>('layers');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleRailClick = (tab: WorkbenchTab) => {
    if (!isCollapsed && activeTab === tab) {
      setIsCollapsed(true);
    } else {
      setActiveTab(tab);
      setIsCollapsed(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Slim Activity Rail */}
      <nav className="dock-rail" aria-label="Workbench Navigation">
        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => setIsCollapsed((prev) => !prev)}
          title={isCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
          aria-label="Toggle Inspector"
        >
          <IconPanelLeft size={16} />
        </button>

        <div className="dock-rail-divider" />

        <button
          type="button"
          data-testid="rail-tab-layers"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => handleRailClick('layers')}
          title="Surface Analysis Layers (1-6)"
          aria-label="Layers"
        >
          <IconLayers size={16} />
          <span className="dock-rail-label">Layers</span>
        </button>

        <button
          type="button"
          data-testid="rail-tab-hydro"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'hydro' ? 'active' : ''}`}
          onClick={() => handleRailClick('hydro')}
          title="Hydrology & Drainage Basin"
          aria-label="Hydro"
        >
          <IconDroplet size={16} />
          <span className="dock-rail-label">Hydro</span>
        </button>

        <button
          type="button"
          data-testid="rail-tab-profile"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleRailClick('profile')}
          title="2D Profile Transect Tool (P)"
          aria-label="Profile"
        >
          <IconRuler size={16} />
          <span className="dock-rail-label">Profile</span>
        </button>

        <button
          type="button"
          data-testid="rail-tab-data"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'data' ? 'active' : ''}`}
          onClick={() => handleRailClick('data')}
          title="Data Import & Metadata"
          aria-label="Data"
        >
          <IconFolderUp size={16} />
          <span className="dock-rail-label">Data</span>
          {warnings.length > 0 && <span className="rail-warn-dot" aria-hidden="true" />}
        </button>

        <button
          type="button"
          data-testid="rail-tab-scene"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'scene' ? 'active' : ''}`}
          onClick={() => handleRailClick('scene')}
          title="3D Camera & Scene Settings"
          aria-label="3D"
        >
          <IconCube size={16} />
          <span className="dock-rail-label">3D</span>
        </button>

        <button
          type="button"
          data-testid="rail-tab-export"
          className={`dock-rail-btn ${!isCollapsed && activeTab === 'export' ? 'active' : ''}`}
          onClick={() => handleRailClick('export')}
          title="Geospatial Export (GeoTIFF, GeoJSON, PNG)"
          aria-label="Export"
        >
          <IconDownload size={16} />
          <span className="dock-rail-label">Export</span>
        </button>
      </nav>

      {/* Focused Workbench Inspector Pane */}
      <div className="workbench-panel">
        <div className="workbench-panel-header">
          <span className="workbench-panel-title">{TAB_TITLES[activeTab]}</span>
          <button
            type="button"
            className="workbench-collapse-btn"
            onClick={() => setIsCollapsed(true)}
            title="Collapse panel"
            aria-label="Collapse panel"
          >
            <IconChevronRight size={14} className="rotate-180" />
          </button>
        </div>

        <div className="workbench-panel-body">
          {activeTab === 'layers' && (
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
          )}

          {activeTab === 'hydro' && (
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
          )}

          {activeTab === 'profile' && (
            <div className="panel-stack">
              {activeMode === 'transect-a' || activeMode === 'transect-b' ? (
                <div className="control-block">
                  <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {activeMode === 'transect-a' ? (
                      <>
                        <IconCrosshair size={13} className="text-accent" />
                        <span>Click 1st point on 3D terrain to start transect (Point A)</span>
                      </>
                    ) : (
                      <>
                        <IconTarget size={13} className="text-sky" />
                        <span>Click 2nd point on 3D terrain to finish cut (Point B)</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button button-sm button-secondary button-full"
                    onClick={onCancelTransect}
                  >
                    Cancel Transect
                  </button>
                </div>
              ) : (
                <div className="control-block">
                  <button
                    type="button"
                    className="button button-sm button-primary button-full"
                    onClick={onStartTransect}
                    disabled={!grid}
                  >
                    <IconRuler size={14} />
                    <span>Draw 2D Profile Transect</span>
                  </button>
                  <p className="panel-helper-text">
                    Pick two points on the 3D terrain surface to sample elevation, surface distance, and cumulative gain/loss.
                  </p>
                </div>
              )}

              {profileResult && (
                <div className="panel-subsection">
                  <div className="subsection-header">
                    <span className="subsection-label">Active transect</span>
                    <span className="monospace text-muted" style={{ fontSize: '0.7rem' }}>
                      {profileResult.points.length} pts
                    </span>
                  </div>
                  <table className="spec-table" style={{ marginBottom: '0.65rem' }}>
                    <tbody>
                      <tr>
                        <td>Distance</td>
                        <td className="monospace">
                          {(profileResult.totalHorizontalDistance / 1000).toFixed(2)} km
                        </td>
                      </tr>
                      <tr>
                        <td>Elevation span</td>
                        <td className="monospace">
                          {Math.round(profileResult.minElevation)}–{Math.round(profileResult.maxElevation)} m
                        </td>
                      </tr>
                      <tr>
                        <td>Gain / Loss</td>
                        <td className="monospace">
                          <span className="text-accent">+{Math.round(profileResult.elevationGain)}m</span>
                          {' / '}
                          <span className="text-danger">-{Math.round(profileResult.elevationLoss)}m</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

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
            </div>
          )}

          {activeTab === 'data' && (
            <div className="panel-stack">
              {/* Compact GeoTIFF File Import */}
              <div className="control-block">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".tif,.tiff,.geotiff"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="button button-sm button-primary button-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconFolderUp size={14} />
                  <span>Import GeoTIFF Raster…</span>
                </button>
                <p className="panel-helper-text">
                  Or drag &amp; drop any local <code>.tif</code> / <code>.tiff</code> elevation DEM onto the viewport.
                </p>
              </div>

              {/* Sample Datasets */}
              <div className="panel-subsection">
                <div className="section-title">Open Sample DEMs</div>
                <div className="sample-list">
                  <button
                    type="button"
                    className="sample-row-btn"
                    onClick={() =>
                      onLoadSampleFile(
                        'samples/mount_st_helens.tif',
                        'Mount St. Helens (USGS 3DEP 30m)'
                      )
                    }
                    disabled={isLoading}
                    data-testid="sample-mount-st-helens"
                  >
                    <span className="sample-row-title">Mount St. Helens</span>
                    <span className="sample-row-meta">USGS 3DEP · 128×128</span>
                  </button>

                  <button
                    type="button"
                    className="sample-row-btn"
                    onClick={() =>
                      onLoadSampleFile('samples/drainage_basin.tif', 'Eagle Creek Basin (30m UTM)')
                    }
                    disabled={isLoading}
                    data-testid="sample-drainage-basin"
                  >
                    <span className="sample-row-title">Eagle Creek Basin</span>
                    <span className="sample-row-meta">Copernicus · 128×128</span>
                  </button>

                  <button
                    type="button"
                    className="sample-row-btn"
                    onClick={() =>
                      onLoadSampleFile('samples/sample_dem.tif', 'Sample Volcanic Peak (30m UTM)')
                    }
                    disabled={isLoading}
                    data-testid="sample-volcanic-peak"
                  >
                    <span className="sample-row-title">Volcanic Peak</span>
                    <span className="sample-row-meta">Sample · 35×35</span>
                  </button>
                </div>
              </div>

              {/* Synthetic Terrains */}
              <div className="panel-subsection">
                <div className="section-title">Synthetic Terrains</div>
                <div className="button-group">
                  <button type="button" className="button button-sm" onClick={() => onLoadSynthetic('mountain')}>
                    Mountain
                  </button>
                  <button type="button" className="button button-sm" onClick={() => onLoadSynthetic('valley')}>
                    Valley
                  </button>
                  <button type="button" className="button button-sm" onClick={() => onLoadSynthetic('pyramid')}>
                    Pyramid
                  </button>
                  <button type="button" className="button button-sm" onClick={() => onLoadSynthetic('plane')}>
                    Plane
                  </button>
                  <button type="button" className="button button-sm" onClick={() => onLoadSynthetic('depression')}>
                    Depression
                  </button>
                </div>
              </div>

              {/* Clean Hairline Raster Specification Table */}
              {grid && stats && (
                <div className="panel-subsection">
                  <div className="section-title">Raster Specification</div>
                  <table className="spec-table">
                    <tbody>
                      <tr>
                        <td>Dimensions</td>
                        <td className="monospace">
                          {grid.width} &times; {grid.height} ({(grid.width * grid.height).toLocaleString()})
                        </td>
                      </tr>
                      <tr>
                        <td>Cell spacing</td>
                        <td className="monospace">
                          {grid.pixelSizeX.toFixed(2)} &times; {grid.pixelSizeY.toFixed(2)} {grid.crs.unit}
                        </td>
                      </tr>
                      <tr>
                        <td>CRS</td>
                        <td className="monospace">{grid.crs.code ?? 'Unassigned'}</td>
                      </tr>
                      <tr>
                        <td>Elevation range</td>
                        <td className="monospace">
                          {stats.min.toFixed(1)} – {stats.max.toFixed(1)} m
                        </td>
                      </tr>
                      <tr>
                        <td>Relief span</td>
                        <td className="monospace">{(stats.max - stats.min).toFixed(1)} m</td>
                      </tr>
                      <tr>
                        <td>NoData cells</td>
                        <td className="monospace">{stats.noDataCount.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="panel-subsection">
                  <div className="section-title" style={{ color: 'var(--accent-warning)' }}>
                    Dataset Notices ({warnings.length})
                  </div>
                  {warnings.map((w, idx) => (
                    <div key={idx} className="alert alert-warning">
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scene' && (
            <div className="panel-stack">
              <div className="control-block">
                <div className="section-title">Camera Bookmarks</div>
                <div className="camera-grid">
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => onSetCameraPreset('top-down')}
                    title="Top-Down 2D Map View (Shortcut: T)"
                  >
                    <IconMap size={13} />
                    <span>Top-Down</span>
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => onSetCameraPreset('isometric')}
                    title="45° Isometric View (Shortcut: I)"
                  >
                    <IconCube size={13} />
                    <span>45° Isometric</span>
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => onSetCameraPreset('oblique')}
                    title="Low-Angle Horizon Oblique (Shortcut: O)"
                  >
                    <IconHorizon size={13} />
                    <span>Oblique</span>
                  </button>
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    onClick={() => onSetCameraPreset('default')}
                    title="Default Orbit View (Shortcut: R)"
                  >
                    <IconRotateCcw size={13} />
                    <span>Default View</span>
                  </button>
                </div>
              </div>

              <div className="panel-subsection">
                <div className="control-group">
                  <div className="control-label">
                    <span>Vertical exaggeration</span>
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

                <div className="stack-sm">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => onWireframeChange(e.target.checked)}
                    />
                    <span>Show mesh wireframe</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => onShowGridChange(e.target.checked)}
                    />
                    <span>Show datum reference grid</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="button button-sm button-secondary button-full"
                  style={{ marginTop: '0.75rem' }}
                  onClick={onResetCamera}
                >
                  <IconRotateCcw size={13} />
                  <span>Reset Camera View</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
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
          )}
        </div>
      </div>
    </aside>
  );
};
