import React, { useEffect, useState } from 'react';
import type { TerrainViewer } from '@/features/terrain/terrain-viewer';

interface CompassWidgetProps {
  viewerRef?: React.RefObject<TerrainViewer | null>;
  onAlignNorth?: () => void;
  className?: string;
}

export const CompassWidget: React.FC<CompassWidgetProps> = ({
  viewerRef,
  onAlignNorth,
  className,
}) => {
  const [headingDeg, setHeadingDeg] = useState(0);

  useEffect(() => {
    let animId: number;
    const updateHeading = () => {
      if (viewerRef?.current) {
        const rad = viewerRef.current.getCameraAzimuth();
        // Convert radians to degrees: 0° is North
        const deg = (rad * 180) / Math.PI;
        // Normalize 0..360
        const normDeg = (deg % 360 + 360) % 360;
        setHeadingDeg(normDeg);
      }
      animId = requestAnimationFrame(updateHeading);
    };

    animId = requestAnimationFrame(updateHeading);
    return () => cancelAnimationFrame(animId);
  }, [viewerRef]);

  // Needle rotates opposite to camera heading so it points to True North
  const needleRotation = -headingDeg;

  return (
    <button
      type="button"
      className={`compass-widget ${className ?? ''}`}
      onClick={onAlignNorth}
      title={`Heading: ${Math.round(headingDeg)}° (Click to orient North)`}
      aria-label="Compass Orientation Widget"
    >
      <svg width="28" height="28" viewBox="0 0 32 32" className="compass-svg">
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="rgba(13, 18, 29, 0.75)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.2"
        />
        {/* Tick marks */}
        <line x1="16" y1="3" x2="16" y2="5" stroke="#38bdf8" strokeWidth="1.5" />
        <line x1="16" y1="27" x2="16" y2="29" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
        <line x1="3" y1="16" x2="5" y2="16" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
        <line x1="27" y1="16" x2="29" y2="16" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />

        {/* Rotating North-South Needle */}
        <g transform={`rotate(${needleRotation} 16 16)`}>
          {/* North pointer (Emerald / Sky) */}
          <polygon points="16 6 19 16 16 14" fill="#38bdf8" />
          <polygon points="16 6 13 16 16 14" fill="#0284c7" />
          {/* South pointer (Muted) */}
          <polygon points="16 26 19 16 16 18" fill="rgba(255, 255, 255, 0.45)" />
          <polygon points="16 26 13 16 16 18" fill="rgba(255, 255, 255, 0.2)" />
          <circle cx="16" cy="16" r="2" fill="#ffffff" />
        </g>
      </svg>
      <span className="compass-label">N</span>
    </button>
  );
};
