import React, { useRef, useState } from 'react';
import type { ProfilePoint, ProfileResult } from '@/features/analysis/profile';
import { IconChartLine, IconClose } from './common/Icons';

interface ProfileViewerProps {
  profile: ProfileResult | null;
  hoveredPoint: ProfilePoint | null;
  onHoverPoint: (point: ProfilePoint | null) => void;
  onClose: () => void;
  onExportCsv: () => void;
}

export const ProfileViewer: React.FC<ProfileViewerProps> = ({
  profile,
  hoveredPoint,
  onHoverPoint,
  onClose,
  onExportCsv,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeScrubber, setActiveScrubber] = useState<ProfilePoint | null>(null);

  if (!profile || profile.points.length < 2) return null;

  const { points, totalHorizontalDistance, minElevation, maxElevation } = profile;

  // Chart dimensions and margins
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 25, bottom: 30, left: 55 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Add 10% elevation padding on top and bottom for visual breathing room
  const elevSpan = Math.max(maxElevation - minElevation, 10);
  const yMin = Math.max(0, minElevation - elevSpan * 0.1);
  const yMax = maxElevation + elevSpan * 0.1;
  const yRange = yMax - yMin;

  // Coordinate scales
  const getX = (dist: number) => {
    if (totalHorizontalDistance <= 0) return padding.left;
    return padding.left + (dist / totalHorizontalDistance) * plotWidth;
  };

  const getY = (elev: number | null) => {
    if (elev === null) return padding.top + plotHeight;
    return padding.top + plotHeight - ((elev - yMin) / yRange) * plotHeight;
  };

  // Build SVG path strings
  let pathD = '';
  let areaD = '';

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    const x = getX(pt.distanceHorizontal);
    const y = getY(pt.elevation);

    if (i === 0) {
      pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      areaD = `M ${x.toFixed(1)} ${padding.top + plotHeight} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      areaD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  const lastPt = points[points.length - 1]!;
  areaD += ` L ${getX(lastPt.distanceHorizontal).toFixed(1)} ${padding.top + plotHeight} Z`;

  // X Axis Ticks (5 intervals)
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => {
    const dist = t * totalHorizontalDistance;
    const label = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    return { x: getX(dist), label };
  });

  // Y Axis Ticks (4 intervals)
  const yTicks = [0, 0.33, 0.66, 1.0].map((t) => {
    const elev = yMin + t * yRange;
    return { y: getY(elev), label: `${Math.round(elev)} m` };
  });

  // Handle mouse scrub
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    // Constrain to plot area
    const clampedX = Math.max(padding.left, Math.min(padding.left + plotWidth, svgX));
    const distRatio = (clampedX - padding.left) / plotWidth;
    const targetDist = distRatio * totalHorizontalDistance;

    // Find nearest sampled point
    let nearest = points[0]!;
    let minDiff = Math.abs(nearest.distanceHorizontal - targetDist);

    for (let i = 1; i < points.length; i++) {
      const pt = points[i]!;
      const diff = Math.abs(pt.distanceHorizontal - targetDist);
      if (diff < minDiff) {
        nearest = pt;
        minDiff = diff;
      }
    }

    setActiveScrubber(nearest);
    onHoverPoint(nearest);
  };

  const handleMouseLeave = () => {
    setActiveScrubber(null);
    onHoverPoint(null);
  };

  const currentPt = hoveredPoint ?? activeScrubber;

  return (
    <div className="profile-viewer-panel">
      <div className="profile-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <IconChartLine size={15} className="text-accent" />
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
            Elevation Cross-Section
          </span>
          <span className="monospace text-muted" style={{ fontSize: '0.72rem' }}>
            {points.length} samples
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            className="button button-sm button-secondary"
            onClick={onExportCsv}
            title="Download sampled profile data as CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={onClose}
            title="Close elevation profile drawer (Esc)"
            style={{ padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="profile-metrics-row">
        <div className="profile-stat-box">
          <div className="stat-label">Horizontal Distance</div>
          <div className="stat-val monospace">
            {totalHorizontalDistance >= 1000
              ? `${(totalHorizontalDistance / 1000).toFixed(2)} km`
              : `${Math.round(totalHorizontalDistance)} m`}
          </div>
        </div>
        <div className="profile-stat-box">
          <div className="stat-label">3D Surface Distance</div>
          <div className="stat-val monospace">
            {profile.totalSurfaceDistance >= 1000
              ? `${(profile.totalSurfaceDistance / 1000).toFixed(2)} km`
              : `${Math.round(profile.totalSurfaceDistance)} m`}
          </div>
        </div>
        <div className="profile-stat-box">
          <div className="stat-label">Elevation Min/Max</div>
          <div className="stat-val monospace">
            {Math.round(minElevation)}m – {Math.round(maxElevation)}m
          </div>
        </div>
        <div className="profile-stat-box">
          <div className="stat-label">Elevation Gain / Loss</div>
          <div className="stat-val monospace">
            <span style={{ color: 'var(--accent-primary)' }}>+{Math.round(profile.elevationGain)}m</span>
            {' / '}
            <span style={{ color: 'var(--accent-danger)' }}>-{Math.round(profile.elevationLoss)}m</span>
          </div>
        </div>
      </div>

      {/* Profile Chart Area */}
      <div className="profile-svg-container">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="profile-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="profileAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2fb389" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2fb389" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={padding.left + plotWidth}
                y2={tick.y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="profile-axis-text"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {xTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x}
                y1={padding.top}
                x2={tick.x}
                y2={padding.top + plotHeight}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={tick.x}
                y={padding.top + plotHeight + 16}
                textAnchor="middle"
                className="profile-axis-text"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="rgba(255, 255, 255, 0.15)"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="rgba(255, 255, 255, 0.15)"
          />

          {/* Topographic cut fill & curve */}
          <path d={areaD} fill="url(#profileAreaGrad)" />
          <path
            d={pathD}
            fill="none"
            stroke="#2fb389"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Active Scrubber Indicator */}
          {currentPt && currentPt.elevation !== null && (
            <g>
              {/* Vertical scrubber line */}
              <line
                x1={getX(currentPt.distanceHorizontal)}
                y1={padding.top}
                x2={getX(currentPt.distanceHorizontal)}
                y2={padding.top + plotHeight}
                stroke="#e5a93c"
                strokeWidth="1.25"
                strokeDasharray="3 2"
              />
              {/* Highlight dot on curve */}
              <circle
                cx={getX(currentPt.distanceHorizontal)}
                cy={getY(currentPt.elevation)}
                r="4"
                fill="#e5a93c"
                stroke="#141518"
                strokeWidth="2"
              />

              {/* Scrubber Tooltip */}
              <g
                transform={`translate(${Math.max(
                  padding.left + 55,
                  Math.min(padding.left + plotWidth - 75, getX(currentPt.distanceHorizontal))
                )}, ${Math.max(padding.top + 16, getY(currentPt.elevation) - 14)})`}
              >
                <rect
                  x="-70"
                  y="-18"
                  width="140"
                  height="22"
                  rx="4"
                  fill="rgba(20, 21, 24, 0.96)"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-3.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10.5"
                  fontFamily="monospace"
                >
                  {Math.round(currentPt.elevation)}m |{' '}
                  {currentPt.distanceHorizontal >= 1000
                    ? `${(currentPt.distanceHorizontal / 1000).toFixed(2)}km`
                    : `${Math.round(currentPt.distanceHorizontal)}m`}
                  {currentPt.slopeDegrees !== null ? ` | ${Math.round(currentPt.slopeDegrees)}°` : ''}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
