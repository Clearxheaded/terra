import type { TerrainViewer } from '@/features/terrain/terrain-viewer';
import { downloadFile } from './download';

export interface ViewportExportOptions {
  filename?: string;
  datasetName?: string;
  includeScaleBar?: boolean;
  includeCompass?: boolean;
}

/**
 * Finds the closest standard cartographic metric distance (e.g., 100m, 500m, 1km, 5km).
 */
function getNiceMetricInterval(rawMeters: number): { meters: number; label: string } {
  const intervals = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
  ];

  let best = intervals[0]!;
  let bestDiff = Math.abs(rawMeters - best);

  for (let i = 1; i < intervals.length; i++) {
    const val = intervals[i]!;
    const diff = Math.abs(rawMeters - val);
    if (diff < bestDiff) {
      best = val;
      bestDiff = diff;
    }
  }

  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  return { meters: best, label };
}

/**
 * Captures the active WebGL viewport, composes cartographic overlays (scale bar, orientation compass,
 * and dataset badge), and prompts client-side download as high-resolution PNG.
 */
export async function exportViewportToPng(
  viewer: TerrainViewer,
  options: ViewportExportOptions = {}
): Promise<void> {
  const {
    filename = 'terra-viewport.png',
    datasetName,
    includeScaleBar = true,
    includeCompass = true,
  } = options;

  // Render fresh frame and capture WebGL canvas
  const glCanvas = viewer.getDomCanvas();
  viewer.renderNow();

  const width = glCanvas.width;
  const height = glCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create 2D canvas context for export.');

  // 1. Draw WebGL frame
  ctx.drawImage(glCanvas, 0, 0);

  const scaleFactor = Math.max(1, width / 1200);

  // 2. Cartographic Orientation Compass
  if (includeCompass) {
    const compassRadius = 26 * scaleFactor;
    const cx = width - 40 * scaleFactor;
    const cy = 45 * scaleFactor;

    const azimuthRad = viewer.getCameraAzimuth(); // Radians

    ctx.save();
    ctx.translate(cx, cy);

    // Compass circle background
    ctx.beginPath();
    ctx.arc(0, 0, compassRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
    ctx.fill();
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    // Rotate to match camera orientation (North points up when azimuth is 0)
    ctx.rotate(-azimuthRad);

    // North arrow (Vibrant Red)
    ctx.beginPath();
    ctx.moveTo(0, -compassRadius);
    ctx.lineTo(compassRadius * 0.35, 0);
    ctx.lineTo(0, compassRadius * 0.2);
    ctx.fillStyle = '#ff3b30';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -compassRadius);
    ctx.lineTo(-compassRadius * 0.35, 0);
    ctx.lineTo(0, compassRadius * 0.2);
    ctx.fillStyle = '#d32f2f';
    ctx.fill();

    // South arrow (Silver/Slate)
    ctx.beginPath();
    ctx.moveTo(0, compassRadius);
    ctx.lineTo(compassRadius * 0.35, 0);
    ctx.lineTo(0, -compassRadius * 0.2);
    ctx.fillStyle = '#e0e0e0';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, compassRadius);
    ctx.lineTo(-compassRadius * 0.35, 0);
    ctx.lineTo(0, -compassRadius * 0.2);
    ctx.fillStyle = '#9e9e9e';
    ctx.fill();

    // 'N' label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(11 * scaleFactor)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', 0, -compassRadius - 6 * scaleFactor);

    ctx.restore();
  }

  // 3. Metric Scale Bar
  if (includeScaleBar) {
    const geomData = viewer.getCurrentGeomData();
    if (geomData) {
      const metersPerPixel = viewer.calculateMetersPerPixel();
      if (metersPerPixel > 0) {
        const targetPx = 180 * scaleFactor;
        const rawMeters = metersPerPixel * targetPx;
        const { meters, label } = getNiceMetricInterval(rawMeters);
        const barPx = meters / metersPerPixel;

        const x = 30 * scaleFactor;
        const y = height - 35 * scaleFactor;
        const barHeight = 6 * scaleFactor;

        // Background backing
        ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
        ctx.fillRect(
          x - 10 * scaleFactor,
          y - 24 * scaleFactor,
          barPx + 20 * scaleFactor,
          36 * scaleFactor
        );

        // Scale bar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scaleFactor;
        ctx.strokeRect(x, y, barPx, barHeight);

        // Checker alternating fills
        const half = barPx / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, half, barHeight);
        ctx.fillStyle = '#1f242c';
        ctx.fillRect(x + half, y, half, barHeight);

        // Scale text
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${Math.round(11 * scaleFactor)}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('0', x, y - 4 * scaleFactor);
        ctx.textAlign = 'right';
        ctx.fillText(label, x + barPx, y - 4 * scaleFactor);
      }
    }
  }

  // 4. Watermark & Dataset Badge
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `${Math.round(11 * scaleFactor)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const badgeText = datasetName ? `TERRA — ${datasetName}` : 'TERRA Geospatial Analysis';
  ctx.fillText(badgeText, width - 25 * scaleFactor, height - 20 * scaleFactor);
  ctx.restore();

  // Export to Blob and download
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        downloadFile(blob, filename, 'image/png');
      }
      resolve();
    }, 'image/png');
  });
}

