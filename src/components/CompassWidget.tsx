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
      <svg width="26" height="26" viewBox="0 0 32 32" className="compass-svg">
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="rgba(20, 21, 24, 0.9)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.2"
        />
        {/* Tick marks */}
        <line x1="16" y1="3" x2="16" y2="5.5" stroke="#2fb389" strokeWidth="1.5" />
        <line x1="16" y1="26.5" x2="16" y2="29" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
        <line x1="3" y1="16" x2="5.5" y2="16" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
        <line x1="26.5" y1="16" x2="29" y2="16" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />

        {/* Rotating North-South Needle */}
        <g transform={`rotate(${needleRotation} 16 16)`}>
          {/* North pointer (Signal Red-Orange / Sage) */}
          <polygon points="16 6 18.8 16 16 14" fill="#e05252" />
          <polygon points="16 6 13.2 16 16 14" fill="#b83b3b" />
          {/* South pointer (Muted) */}
          <polygon points="16 26 18.8 16 16 18" fill="rgba(255, 255, 255, 0.35)" />
          <polygon points="16 26 13.2 16 16 18" fill="rgba(255, 255, 255, 0.16)" />
          <circle cx="16" cy="16" r="1.8" fill="#eceef2" />
        </g>
      </svg>
      <span className="compass-label">N</span>
    </button>
  );
};
