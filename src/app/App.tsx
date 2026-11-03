import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { calculateAspect, calculateHillshade, calculateSlope } from '@/features/analysis';
import type { AnalysisLayerType, SlopeUnit } from '@/features/analysis/types';
import {
  calculateFlowAccumulation,
  calculateFlowDirection,
  delineateWatershed,
  fillDepressions,
  traceFlowPath,
} from '@/features/hydrology';
import { TerrainViewport } from '@/features/terrain/TerrainViewport';
import { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { parseGeoTIFF } from '@/lib/geospatial/geotiff-loader';
import {
  createSyntheticTerrain,
  type SyntheticTerrainOptions,
} from '@/lib/geospatial/synthetic-terrain';

export const App: React.FC = () => {
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

  // Hydrology state
  const [isConditioned, setIsConditioned] = useState(true);
  const [showStreamNetwork, setShowStreamNetwork] = useState(false);
  const [streamThreshold, setStreamThreshold] = useState(100);
  const [selectedPourPoint, setSelectedPourPoint] = useState<{ col: number; row: number } | null>(
    null
  );

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

  // Active layer vertex data buffer
  const activeLayerData = useMemo(() => {
    if (activeLayer === 'slope') return slopeResult?.data ?? null;
    if (activeLayer === 'aspect') return aspectResult?.data ?? null;
    if (activeLayer === 'hillshade') return hillshadeResult?.data ?? null;
    if (activeLayer === 'd8-flow') {
      if (!flowDirResult) return null;
      // Convert uint8 bit-codes to float for WebGL vertex coloring
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

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedPourPoint(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseGeoTIFF(buffer, file.name);
      setGrid(result.grid);
      setWarnings(result.warnings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse GeoTIFF dataset.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadSampleFile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedPourPoint(null);
    try {
      const response = await fetch('/samples/sample_dem.tif');
      if (!response.ok) {
        throw new Error(`Failed to load sample dataset: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const result = await parseGeoTIFF(buffer, 'Sample Volcanic Peak (30m UTM)');
      setGrid(result.grid);
      setWarnings(result.warnings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sample file.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadSynthetic = useCallback((type: SyntheticTerrainOptions['type']) => {
    setErrorMessage(null);
    setWarnings([]);
    setSelectedPourPoint(null);
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

  const handleSelectPourPoint = useCallback(
    (point: { col: number; row: number; elevation: number }) => {
      setSelectedPourPoint({ col: point.col, row: point.row });
    },
    []
  );

  const handleClearInspection = useCallback(() => {
    setSelectedPourPoint(null);
  }, []);

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
          warnings={warnings}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
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
          onClearInspection={handleClearInspection}
          onFileUpload={handleFileUpload}
          onLoadSynthetic={handleLoadSynthetic}
          onLoadSampleFile={handleLoadSampleFile}
          onResetCamera={handleResetCamera}
          isLoading={isLoading}
        />

        <TerrainViewport
          grid={routingGrid ?? grid}
          activeLayer={activeLayer}
          activeLayerData={activeLayerData}
          maxLayerVal={maxLayerVal}
          watershedMask={activeWatershed?.mask ?? null}
          sunAzimuth={sunAzimuth}
          sunAltitude={sunAltitude}
          verticalExaggeration={verticalExaggeration}
          wireframe={wireframe}
          isLoading={isLoading}
          errorMessage={errorMessage}
          resetCameraTrigger={resetCameraTrigger}
          showStreamNetwork={showStreamNetwork}
          streamThreshold={streamThreshold}
          flowDirData={flowDirResult?.data ?? null}
          flowAccumData={flowAccumResult?.data ?? null}
          tracedFlowPath={tracedFlowPath}
          pourPoint={selectedPourPoint}
          onSelectPourPoint={handleSelectPourPoint}
        />
      </div>
    </div>
  );
};
