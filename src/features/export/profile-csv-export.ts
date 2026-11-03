import type { ProfileResult } from '@/features/analysis/profile';
import { downloadFile } from './download';

/**
 * Serializes an elevation profile result into a CSV string.
 */
export function serializeProfileToCsv(profile: ProfileResult): string {
  const headers = [
    'Index',
    'Column',
    'Row',
    'Map_X',
    'Map_Y',
    'Elevation_m',
    'Elevation_ft',
    'Horizontal_Dist_m',
    'Surface_Dist_m',
    'Slope_deg',
  ];

  const rows: string[] = [headers.join(',')];

  for (const pt of profile.points) {
    const elevM = pt.elevation !== null ? pt.elevation.toFixed(2) : '';
    const elevFt = pt.elevation !== null ? (pt.elevation * 3.28084).toFixed(2) : '';
    const slope = pt.slopeDegrees !== null ? pt.slopeDegrees.toFixed(2) : '';

    rows.push(
      [
        pt.index,
        pt.col.toFixed(2),
        pt.row.toFixed(2),
        pt.geoX.toFixed(4),
        pt.geoY.toFixed(4),
        elevM,
        elevFt,
        pt.distanceHorizontal.toFixed(2),
        pt.distanceSurface.toFixed(2),
        slope,
      ].join(',')
    );
  }

  return rows.join('\r\n');
}

/**
 * Exports elevation profile data points to a CSV file and prompts download.
 */
export function exportProfileToCsv(
  profile: ProfileResult,
  filename = 'terra-elevation-profile.csv'
): void {
  const csv = serializeProfileToCsv(profile);
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

