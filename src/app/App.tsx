import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ProfileViewer } from '@/components/ProfileViewer';
import { Sidebar } from '@/components/Sidebar';
import {
  calculateAspect,
  calculateElevationProfile,
  calculateHillshade,
  calculateSlope,
  type BaseLayerType,
  type BlendMode,
  type OverlayLayerType,
  type ProfilePoint,
} from '@/features/analysis';
import type { AnalysisLayerType, SlopeUnit } from '@/features/analysis/types';
import { exportProfileToCsv } from '@/features/export';
import {
  calculateFlowAccumulation,
  calculateFlowDirection,
  delineateWatershed,
  fillDepressions,
  traceFlowPath,
} from '@/features/hydrology';
import type { LayerBlendOptions } from '@/features/terrain/terrain-mesh';
import type { TerrainViewer } from '@/features/terrain/terrain-viewer';
import { TerrainViewport } from '@/features/terrain/TerrainViewport';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { parseGeoTIFF } from '@/lib/geospatial/geotiff-loader';
import { checkRasterSafety } from '@/lib/geospatial/memory-manager';
import {
  createSyntheticTerrain,
  type SyntheticTerrainOptions,
} from '@/lib/geospatial/synthetic-terrain';

export const App: React.FC = () => {
  const viewerRef = useRef<TerrainViewer | null>(null);

  const [grid, setGrid] = useState<ElevationGrid | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeLayer, setActiveLayer] = useState<AnalysisLayerType>('elevation');
  const [slopeUnit, setSlopeUnit] = useState<SlopeUnit>('degrees');
  const [sunAzimuth, setSunAzimuth] = useState<number>(315);
  const [sunAltitude, setSunAltitude] = useState<number>(45);

  const [verticalExaggeration, setVerticalExaggeration] = useState(1.5);
  const [wireframe, setWireframe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);

  // Camera bookmark presets
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{
    preset: 'top-down' | 'isometric' | 'oblique' | 'default';
    id: number;
  } | null>(null);

  // Multi-layer blending state
  const [isBlendingEnabled, setIsBlendingEnabled] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('elevation');
  const [overlayLayer, setOverlayLayer] = useState<OverlayLayerType>('hillshade');
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const [blendMode, setBlendMode] = useState<BlendMode>('multiply');

  // Hydrology state
  const [isConditioned, setIsConditioned] = useState(true);
  const [showStreamNetwork, setShowStreamNetwork] = useState(false);
  const [streamThreshold, setStreamThreshold] = useState(100);
  const [selectedPourPoint, setSelectedPourPoint] = useState<{ col: number; row: number } | null>(
    null
  );

  // Elevation Profile state
  const [activeMode, setActiveMode] = useState<'inspect' | 'transect-a' | 'transect-b'>('inspect');
  const [transectStart, setTransectStart] = useState<{ col: number; row: number; elevation: number } | null>(null);
  const [transectEnd, setTransectEnd] = useState<{ col: number; row: number; elevation: number } | null>(null);
  const [hoveredProfilePoint, setHoveredProfilePoint] = useState<ProfilePoint | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Analysis computations (memoized per grid / settings)
  const slopeResult = useMemo(() => {
    if (!grid) return null;
    return calculateSlope(grid, slopeUnit);
  }, [grid, slopeUnit]);

  const aspectResult = useMemo(() => {
    if (!grid) return null;
    return calculateAspect(grid);
  }, [grid]);

  const hillshadeResult = useMemo(() => {
    if (!grid) return null;
    return calculateHillshade(grid, { azimuth: sunAzimuth, altitude: sunAltitude });
  }, [grid, sunAzimuth, sunAltitude]);

  // Hydrology: Conditioned (Sink-Filled) DEM via Barnes Priority-Flood
  const conditionedGrid = useMemo(() => {
    if (!grid) return null;
    return fillDepressions(grid);
  }, [grid]);

  // Active routing DEM (either raw or sink-filled)
  const routingGrid = useMemo(() => {
    if (!grid) return null;
    return isConditioned ? (conditionedGrid ?? grid) : grid;
  }, [grid, isConditioned, conditionedGrid]);

  // D8 Flow Direction
  const flowDirResult = useMemo(() => {
    if (!routingGrid) return null;
    return calculateFlowDirection(routingGrid);
  }, [routingGrid]);

  // Flow Accumulation via topological sorting
  const flowAccumResult = useMemo(() => {
    if (!routingGrid || !flowDirResult) return null;
    return calculateFlowAccumulation(routingGrid, flowDirResult.data);
  }, [routingGrid, flowDirResult]);

  // Upstream Watershed Delineation
  const activeWatershed = useMemo(() => {
    if (!selectedPourPoint || !routingGrid || !flowDirResult) return null;
    return delineateWatershed(
      flowDirResult.data,
      routingGrid,
      selectedPourPoint.col,
      selectedPourPoint.row
    );
  }, [selectedPourPoint, routingGrid, flowDirResult]);

  // Downstream Flow Path Tracing
  const tracedFlowPath = useMemo(() => {
    if (!selectedPourPoint || !routingGrid || !flowDirResult || !flowAccumResult) return null;
    return traceFlowPath(
      flowDirResult.data,
      routingGrid,
      flowAccumResult.data,
      selectedPourPoint.col,
      selectedPourPoint.row
    );
  }, [selectedPourPoint, routingGrid, flowDirResult, flowAccumResult]);

  // Active single-layer data buffer
  const activeLayerData = useMemo(() => {
    if (activeLayer === 'slope') return slopeResult?.data ?? null;
    if (activeLayer === 'aspect') return aspectResult?.data ?? null;
    if (activeLayer === 'hillshade') return hillshadeResult?.data ?? null;
    if (activeLayer === 'd8-flow') {
      if (!flowDirResult) return null;
      return new Float32Array(flowDirResult.data);
    }
    if (activeLayer === 'flow-accumulation') {
      return flowAccumResult?.logData ?? null;
    }
    return null;
  }, [activeLayer, slopeResult, aspectResult, hillshadeResult, flowDirResult, flowAccumResult]);

  // Max value for log accumulation normalization
  const maxLayerVal = useMemo(() => {
    if (activeLayer === 'flow-accumulation' && flowAccumResult) {
      return Math.log10(Math.max(flowAccumResult.max, 10));
    }
    return 1.0;
  }, [activeLayer, flowAccumResult]);

  // Multi-layer blending options configuration
  const blendOptions: LayerBlendOptions | undefined = useMemo(() => {
    if (!isBlendingEnabled) return undefined;

    let baseData: Float32Array | null = null;
    if (baseLayer === 'hillshade') {
      baseData = hillshadeResult?.data ?? null;
    }

    let overlayData: Float32Array | null = null;
    if (overlayLayer === 'slope') overlayData = slopeResult?.data ?? null;
    else if (overlayLayer === 'aspect') overlayData = aspectResult?.data ?? null;
    else if (overlayLayer === 'hillshade') overlayData = hillshadeResult?.data ?? null;
    else if (overlayLayer === 'd8-flow' && flowDirResult) overlayData = new Float32Array(flowDirResult.data);
    else if (overlayLayer === 'flow-accumulation') overlayData = flowAccumResult?.logData ?? null;

    const maxOverlay = overlayLayer === 'flow-accumulation' && flowAccumResult
      ? Math.log10(Math.max(flowAccumResult.max, 10))
      : 1.0;

    return {
      baseLayer,
      baseLayerData: baseData,
      overlayLayer,
      overlayLayerData: overlayData,
      overlayOpacity,
      blendMode,
      maxOverlayVal: maxOverlay,
    };
  }, [
    isBlendingEnabled,
    baseLayer,
    overlayLayer,
    overlayOpacity,
    blendMode,
    slopeResult,
    aspectResult,
    hillshadeResult,
    flowDirResult,
    flowAccumResult,
  ]);

  // Elevation Profile Computation
  const profileResult = useMemo(() => {
    if (!grid || !transectStart || !transectEnd) return null;
    return calculateElevationProfile(grid, {
      start: { col: transectStart.col, row: transectStart.row },
      end: { col: transectEnd.col, row: transectEnd.row },
    });
  }, [grid, transectStart, transectEnd]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedPourPoint(null);
    setTransectStart(null);
    setTransectEnd(null);
    setActiveMode('inspect');
    setIsProfileOpen(false);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseGeoTIFF(buffer, file.name);
      const safety = checkRasterSafety(result.grid.width, result.grid.height);
      setGrid(result.grid);
      setWarnings([...result.warnings, ...safety.warnings]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse GeoTIFF dataset.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadSampleFile = useCallback(
    async (
      sampleUrl = '/samples/mount_st_helens.tif',
      datasetTitle = 'Mount St. Helens (USGS 3DEP 30m)'
    ) => {
      setIsLoading(true);
      setErrorMessage(null);
      setSelectedPourPoint(null);
      setTransectStart(null);
      setTransectEnd(null);
      setActiveMode('inspect');
      setIsProfileOpen(false);
      try {
        const response = await fetch(sampleUrl);
        if (!response.ok) {
          throw new Error(`Failed to load sample dataset: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const result = await parseGeoTIFF(buffer, datasetTitle);
        const safety = checkRasterSafety(result.grid.width, result.grid.height);
        setGrid(result.grid);
        setWarnings([...result.warnings, ...safety.warnings]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load sample file.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleLoadSynthetic = useCallback((type: SyntheticTerrainOptions['type']) => {
    setErrorMessage(null);
    setWarnings([]);
    setSelectedPourPoint(null);
    setTransectStart(null);
    setTransectEnd(null);
    setActiveMode('inspect');
    setIsProfileOpen(false);
    const synthetic = createSyntheticTerrain({
      width: 75,
      height: 75,
      type,
      baseElevation: 300,
      peakElevation: 2200,
      noDataBorder: type === 'mountain',
    });
    setGrid(synthetic);
  }, []);

  const handleResetCamera = useCallback(() => {
    setResetCameraTrigger((prev) => prev + 1);
  }, []);

  const handleSetCameraPreset = useCallback((preset: 'top-down' | 'isometric' | 'oblique' | 'default') => {
    setCameraPresetTrigger({ preset, id: Date.now() });
  }, []);

  const handleSelectPourPoint = useCallback(
    (point: { col: number; row: number; elevation: number }) => {
      setSelectedPourPoint({ col: point.col, row: point.row });
    },
    []
  );

  const handleClearInspection = useCallback(() => {
    setSelectedPourPoint(null);
  }, []);

  // Transect Handlers
  const handleStartTransect = useCallback(() => {
    setActiveMode('transect-a');
    setTransectStart(null);
    setTransectEnd(null);
    setIsProfileOpen(false);
  }, []);

  const handleCancelTransect = useCallback(() => {
    setActiveMode('inspect');
  }, []);

  const handleClearProfile = useCallback(() => {
    setTransectStart(null);
    setTransectEnd(null);
    setActiveMode('inspect');
    setIsProfileOpen(false);
  }, []);

  const handleTransectPointA = useCallback((point: { col: number; row: number; elevation: number }) => {
    setTransectStart(point);
    setActiveMode('transect-b');
  }, []);

  const handleTransectPointB = useCallback((point: { col: number; row: number; elevation: number }) => {
    setTransectEnd(point);
    setActiveMode('inspect');
    setIsProfileOpen(true);
  }, []);

  const handleExportProfileCsv = useCallback(() => {
    if (!profileResult) return;
    exportProfileToCsv(profileResult);
  }, [profileResult]);

  // Initialize with synthetic mountain on startup
  useEffect(() => {
    handleLoadSynthetic('mountain');
  }, [handleLoadSynthetic]);

  return (
    <div className="app-container">
      <Header grid={grid} />

      <div className="app-body">
        <Sidebar
          grid={grid}
          viewerRef={viewerRef}
          warnings={warnings}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          activeLayerData={activeLayerData}
          slopeResult={slopeResult}
          aspectResult={aspectResult}
          hillshadeResult={hillshadeResult}
          slopeUnit={slopeUnit}
          onSlopeUnitChange={setSlopeUnit}
          sunAzimuth={sunAzimuth}
          onSunAzimuthChange={setSunAzimuth}
          sunAltitude={sunAltitude}
          onSunAltitudeChange={setSunAltitude}
          verticalExaggeration={verticalExaggeration}
          onVerticalExaggerationChange={setVerticalExaggeration}
          wireframe={wireframe}
          onWireframeChange={setWireframe}
          isBlendingEnabled={isBlendingEnabled}
          onToggleBlending={setIsBlendingEnabled}
          baseLayer={baseLayer}
          onBaseLayerChange={setBaseLayer}
          overlayLayer={overlayLayer}
          onOverlayLayerChange={setOverlayLayer}
          overlayOpacity={overlayOpacity}
          onOverlayOpacityChange={setOverlayOpacity}
          blendMode={blendMode}
          onBlendModeChange={setBlendMode}
          activeMode={activeMode}
          onStartTransect={handleStartTransect}
          onCancelTransect={handleCancelTransect}
          profileResult={profileResult}
          isProfileOpen={isProfileOpen}
          onToggleProfileOpen={setIsProfileOpen}
          onClearProfile={handleClearProfile}
          onSetCameraPreset={handleSetCameraPreset}
          isConditioned={isConditioned}
          onToggleConditioned={setIsConditioned}
          flowDirResult={flowDirResult}
          flowAccumResult={flowAccumResult}
          streamThreshold={streamThreshold}
          onStreamThresholdChange={setStreamThreshold}
          showStreamNetwork={showStreamNetwork}
          onToggleStreamNetwork={setShowStreamNetwork}
          activeWatershed={activeWatershed}
          tracedFlowPath={tracedFlowPath}
          pourPoint={selectedPourPoint}
          onClearInspection={handleClearInspection}
          onFileUpload={handleFileUpload}
          onLoadSynthetic={handleLoadSynthetic}
          onLoadSampleFile={handleLoadSampleFile}
          onResetCamera={handleResetCamera}
          isLoading={isLoading}
        />

        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <TerrainViewport
            grid={routingGrid ?? grid}
            activeLayer={activeLayer}
            activeLayerData={activeLayerData}
            maxLayerVal={maxLayerVal}
            watershedMask={activeWatershed?.mask ?? null}
            blendOptions={blendOptions}
            sunAzimuth={sunAzimuth}
            sunAltitude={sunAltitude}
            verticalExaggeration={verticalExaggeration}
            wireframe={wireframe}
            isLoading={isLoading}
            errorMessage={errorMessage}
            resetCameraTrigger={resetCameraTrigger}
            cameraPresetTrigger={cameraPresetTrigger}
            showStreamNetwork={showStreamNetwork}
            streamThreshold={streamThreshold}
            flowDirData={flowDirResult?.data ?? null}
            flowAccumData={flowAccumResult?.data ?? null}
            tracedFlowPath={tracedFlowPath}
            pourPoint={selectedPourPoint}
            onSelectPourPoint={handleSelectPourPoint}
            activeMode={activeMode}
            onTransectPointA={handleTransectPointA}
            onTransectPointB={handleTransectPointB}
            profileResult={profileResult}
            hoveredProfilePoint={hoveredProfilePoint}
            slopeResult={slopeResult}
            aspectResult={aspectResult}
            viewerRefOut={viewerRef}
            onSetCameraPreset={handleSetCameraPreset}
          />

          {/* Interactive Profile Drawer */}
          {profileResult && isProfileOpen && (
            <ProfileViewer
              profile={profileResult}
              hoveredPoint={hoveredProfilePoint}
              onHoverPoint={setHoveredProfilePoint}
              onClose={() => setIsProfileOpen(false)}
              onExportCsv={handleExportProfileCsv}
            />
          )}
        </div>
      </div>
    </div>
  );
};
