import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { calculateAspect, calculateHillshade, calculateSlope } from '@/features/analysis';
import type { AnalysisLayerType, SlopeUnit } from '@/features/analysis/types';
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

  const activeLayerData = useMemo(() => {
    if (activeLayer === 'slope') return slopeResult?.data ?? null;
    if (activeLayer === 'aspect') return aspectResult?.data ?? null;
    if (activeLayer === 'hillshade') return hillshadeResult?.data ?? null;
    return null;
  }, [activeLayer, slopeResult, aspectResult, hillshadeResult]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
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
          onFileUpload={handleFileUpload}
          onLoadSynthetic={handleLoadSynthetic}
          onLoadSampleFile={handleLoadSampleFile}
          onResetCamera={handleResetCamera}
          isLoading={isLoading}
        />

        <TerrainViewport
          grid={grid}
          activeLayer={activeLayer}
          activeLayerData={activeLayerData}
          sunAzimuth={sunAzimuth}
          sunAltitude={sunAltitude}
          verticalExaggeration={verticalExaggeration}
          wireframe={wireframe}
          isLoading={isLoading}
          errorMessage={errorMessage}
          resetCameraTrigger={resetCameraTrigger}
        />
      </div>
    </div>
  );
};
