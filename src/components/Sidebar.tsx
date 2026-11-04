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
  IconBasin,
  IconChevronRight,
  IconCrosshair,
  IconCube,
  IconDownload,
  IconDroplet,
  IconFolderUp,
  IconHorizon,
  IconLayers,
  IconMap,
  IconMountain,
  IconPanelLeft,
  IconPeak,
  IconRotateCcw,
  IconRuler,
  IconTarget,
} from './common/Icons';
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

  // Floating dock collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Section references for quick scrolling
  const sectionRefs = {
    data: useRef<HTMLDivElement>(null),
    analysis: useRef<HTMLDivElement>(null),
    hydrology: useRef<HTMLDivElement>(null),
    transect: useRef<HTMLDivElement>(null),
    visuals: useRef<HTMLDivElement>(null),
    export: useRef<HTMLDivElement>(null),
  };

  // Accordion modules open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    data: true,
    analysis: true,
    hydrology: true,
    transect: true,
    visuals: true,
    export: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRailClick = (sectionKey: keyof typeof sectionRefs) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    // Ensure the section is expanded
    setOpenSections((prev) => ({ ...prev, [sectionKey]: true }));
    setTimeout(() => {
      sectionRefs[sectionKey].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      {/* 1. Floating Icon Rail (Felt / Mapbox Studio pattern) */}
      <nav className="dock-rail" aria-label="Tool Dock Navigation">
        <button
          type="button"
          className={`dock-rail-btn ${!isCollapsed ? 'active' : ''}`}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Floating Tool Dock' : 'Collapse Tool Dock'}
          aria-label="Toggle Panel"
        >
          <IconPanelLeft size={18} />
        </button>

        <div className="dock-rail-divider" />

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('analysis')}
          title="Surface Analysis Layers (1-6)"
        >
          <IconLayers size={18} />
          <span className="dock-rail-label">Layers</span>
        </button>

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('hydrology')}
          title="Hydrology & Drainage Basin"
        >
          <IconDroplet size={18} />
          <span className="dock-rail-label">Hydro</span>
        </button>

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('transect')}
          title="2D Profile Transect Tool (P)"
        >
          <IconRuler size={18} />
          <span className="dock-rail-label">Profile</span>
        </button>

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('data')}
          title="Data Import & Synthetic Terrains"
        >
          <IconFolderUp size={18} />
          <span className="dock-rail-label">Data</span>
        </button>

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('visuals')}
          title="3D Camera & Viewport Settings"
        >
          <IconCube size={18} />
          <span className="dock-rail-label">3D</span>
        </button>

        <button
          type="button"
          className="dock-rail-btn"
          onClick={() => handleRailClick('export')}
          title="Geospatial Export (GeoTIFF, GeoJSON, PNG)"
        >
          <IconDownload size={18} />
          <span className="dock-rail-label">Export</span>
        </button>
      </nav>

      {/* 2. Floating Panel Card (Glassmorphic Inspector) */}
      <div className="floating-panel-card">
        {/* Panel Header */}
        <div className="floating-panel-header">
          <div className="floating-panel-title">
            <span className="floating-panel-indicator" />
            <span>Workspace Tools</span>
          </div>
          <button
            type="button"
            className="floating-panel-collapse-btn"
            onClick={() => setIsCollapsed(true)}
            title="Collapse tool palette"
          >
            <IconChevronRight size={14} className="rotate-180" />
          </button>
        </div>

        <div className="floating-panel-scroll">
          {/* Module 1: Data & Terrain */}
          <div ref={sectionRefs.data} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('data')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.data ? 'expanded' : ''}`}
                />
                <IconFolderUp size={14} className="text-secondary" />
                <span>Data &amp; Terrain</span>
              </div>
              <span className="accordion-badge">
                {grid ? `${grid.width}×${grid.height}` : 'No DEM'}
              </span>
            </button>

            {openSections.data && (
              <div className="accordion-content">
                {/* Import Dropzone */}
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
                  <div className="upload-dropzone-icon">
                    <IconFolderUp size={24} className="text-emerald" />
                  </div>
                  <div className="upload-dropzone-text">Import GeoTIFF Raster</div>
                  <div className="upload-dropzone-hint">Local .tif / .tiff elevation DEM (in-browser)</div>
                </div>

                {/* Curated Sample Datasets */}
                <div>
                  <div className="section-title">Open Sample DEMs</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="sample-dem-card"
                      onClick={() =>
                        onLoadSampleFile(
                          'samples/mount_st_helens.tif',
                          'Mount St. Helens (USGS 3DEP 30m)'
                        )
                      }
                      disabled={isLoading}
                      data-testid="sample-mount-st-helens"
                    >
                      <span className="sample-dem-icon">
                        <IconPeak size={18} className="text-emerald" />
                      </span>
                      <div>
                        <div className="sample-dem-title">Mount St. Helens</div>
                        <div className="sample-dem-meta">USGS 3DEP &bull; 30m UTM &bull; 128&times;128</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="sample-dem-card"
                      onClick={() =>
                        onLoadSampleFile('samples/drainage_basin.tif', 'Eagle Creek Basin (30m UTM)')
                      }
                      disabled={isLoading}
                      data-testid="sample-drainage-basin"
                    >
                      <span className="sample-dem-icon">
                        <IconBasin size={18} className="text-sky" />
                      </span>
                      <div>
                        <div className="sample-dem-title">Eagle Creek Basin</div>
                        <div className="sample-dem-meta">Copernicus DEM &bull; Sinks &bull; 128&times;128</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="sample-dem-card"
                      onClick={() =>
                        onLoadSampleFile('samples/sample_dem.tif', 'Sample Volcanic Peak (30m UTM)')
                      }
                      disabled={isLoading}
                      data-testid="sample-volcanic-peak"
                    >
                      <span className="sample-dem-icon">
                        <IconMountain size={18} className="text-indigo" />
                      </span>
                      <div>
                        <div className="sample-dem-title">Volcanic Peak</div>
                        <div className="sample-dem-meta">Foundational &bull; 35&times;35 Grid</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Synthetic Models */}
                <div>
                  <div className="section-title">Synthetic Terrains</div>
                  <div className="button-group">
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onLoadSynthetic('mountain')}
                    >
                      Mountain
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onLoadSynthetic('valley')}
                    >
                      Valley
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onLoadSynthetic('pyramid')}
                    >
                      Pyramid
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onLoadSynthetic('plane')}
                    >
                      Plane
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onLoadSynthetic('depression')}
                    >
                      Depression
                    </button>
                  </div>
                </div>

                {/* Metadata Inspector */}
                {grid && stats && (
                  <div>
                    <div className="section-title">Terrain Metadata</div>
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Module 2: Surface Analysis */}
          <div ref={sectionRefs.analysis} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('analysis')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.analysis ? 'expanded' : ''}`}
                />
                <IconLayers size={14} className="text-secondary" />
                <span>Surface Analysis</span>
              </div>
              <span className="accordion-badge" style={{ textTransform: 'capitalize' }}>
                {activeLayer}
              </span>
            </button>

            {openSections.analysis && (
              <div className="accordion-content">
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
              </div>
            )}
          </div>

          {/* Module 3: Hydrology & Drainage */}
          <div ref={sectionRefs.hydrology} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('hydrology')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.hydrology ? 'expanded' : ''}`}
                />
                <IconDroplet size={14} className="text-secondary" />
                <span>Hydrology &amp; Drainage</span>
              </div>
              <span className="accordion-badge">
                {isConditioned ? 'Conditioned' : 'Raw'}
              </span>
            </button>

            {openSections.hydrology && (
              <div className="accordion-content">
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
              </div>
            )}
          </div>

          {/* Module 4: Elevation Profile Transect */}
          <div ref={sectionRefs.transect} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('transect')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.transect ? 'expanded' : ''}`}
                />
                <IconRuler size={14} className="text-secondary" />
                <span>Elevation Profile</span>
              </div>
              <span className="accordion-badge">
                {profileResult ? `${profileResult.points.length} pts` : '2D Tool'}
              </span>
            </button>

            {openSections.transect && (
              <div className="accordion-content">
                {activeMode === 'transect-a' || activeMode === 'transect-b' ? (
                  <div>
                    <div
                      className="alert alert-info"
                      style={{
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.78rem',
                        marginBottom: '0.45rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      {activeMode === 'transect-a' ? (
                        <>
                          <IconCrosshair size={13} className="text-emerald" />
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
                      className="button button-sm button-ghost"
                      style={{ width: '100%' }}
                      onClick={onCancelTransect}
                    >
                      Cancel Transect
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="button button-sm button-primary"
                      style={{
                        width: '100%',
                        marginBottom: profileResult ? '0.5rem' : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                      }}
                      onClick={onStartTransect}
                      disabled={!grid}
                    >
                      <IconRuler size={14} />
                      <span>Draw 2D Profile Transect</span>
                    </button>
                  </div>
                )}

                {profileResult && (
                  <div className="inspection-card" style={{ marginTop: '0.4rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Active Profile</span>
                      <span className="badge badge-primary">{profileResult.points.length} samples</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.3rem',
                        marginBottom: '0.55rem',
                      }}
                    >
                      <div>
                        Dist:{' '}
                        <strong className="monospace">
                          {(profileResult.totalHorizontalDistance / 1000).toFixed(2)} km
                        </strong>
                      </div>
                      <div>
                        Span:{' '}
                        <strong className="monospace">
                          {Math.round(profileResult.minElevation)}–{Math.round(profileResult.maxElevation)}m
                        </strong>
                      </div>
                      <div>
                        Gain:{' '}
                        <strong className="monospace" style={{ color: 'var(--accent-primary)' }}>
                          +{Math.round(profileResult.elevationGain)}m
                        </strong>
                      </div>
                      <div>
                        Loss:{' '}
                        <strong className="monospace" style={{ color: 'var(--accent-danger)' }}>
                          -{Math.round(profileResult.elevationLoss)}m
                        </strong>
                      </div>
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
              </div>
            )}
          </div>

          {/* Module 5: 3D Visualization */}
          <div ref={sectionRefs.visuals} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('visuals')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.visuals ? 'expanded' : ''}`}
                />
                <IconCube size={14} className="text-secondary" />
                <span>3D Visualization</span>
              </div>
              <span className="accordion-badge">
                {verticalExaggeration.toFixed(1)}&times;
              </span>
            </button>

            {openSections.visuals && (
              <div className="accordion-content">
                <div className="control-group">
                  <div className="control-label">
                    <span>Camera Bookmarks</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => onSetCameraPreset('top-down')}
                      title="Orthographic Top-Down 2D Map View (Shortcut: T)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <IconMap size={13} />
                      <span>Top-Down</span>
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => onSetCameraPreset('isometric')}
                      title="45° Isometric Perspective View (Shortcut: I)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <IconCube size={13} />
                      <span>45° Isometric</span>
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => onSetCameraPreset('oblique')}
                      title="Low-Angle Horizon Oblique Perspective (Shortcut: O)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <IconHorizon size={13} />
                      <span>Oblique</span>
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => onSetCameraPreset('default')}
                      title="Reset Default Orbit Perspective (Shortcut: R)"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <IconRotateCcw size={13} />
                      <span>Default View</span>
                    </button>
                  </div>
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Vertical Exaggeration</span>
                    <span className="control-value">{verticalExaggeration.toFixed(1)}&times;</span>
                  </div>
                  <div className="slider-container">
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
                </div>

                <div className="control-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={wireframe}
                      onChange={(e) => onWireframeChange(e.target.checked)}
                    />
                    <span>Show Mesh Wireframe</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="button button-sm button-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
                  onClick={onResetCamera}
                >
                  <IconRotateCcw size={13} />
                  <span>Reset Camera View</span>
                </button>
              </div>
            )}
          </div>

          {/* Module 6: Geospatial Export */}
          <div ref={sectionRefs.export} className="accordion-module">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('export')}
            >
              <div className="accordion-title-wrap">
                <IconChevronRight
                  size={13}
                  className={`accordion-chevron ${openSections.export ? 'expanded' : ''}`}
                />
                <IconDownload size={14} className="text-secondary" />
                <span>Geospatial Export</span>
              </div>
              <span className="accordion-badge">Export</span>
            </button>

            {openSections.export && (
              <div className="accordion-content">
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
              </div>
            )}
          </div>

          {/* Dataset Notices */}
          {warnings.length > 0 && (
            <div className="sidebar-section">
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
      </div>
    </aside>
  );
};
