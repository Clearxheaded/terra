import React from 'react';

interface DragDropOverlayProps {
  isDragging: boolean;
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div
      className="drag-drop-overlay"
      role="region"
      aria-label="File dropzone"
      style={{ pointerEvents: 'none' }}
    >
      <div className="drag-drop-card">
        <div className="drag-drop-icon-container">
          <svg
            className="drag-drop-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <h2 className="drag-drop-title">Drop GeoTIFF Elevation Model Here</h2>
        <p className="drag-drop-subtitle">
          Release to parse raster metadata, compute hydrological routing, and render 3D terrain.
        </p>

        <div className="drag-drop-badges">
          <span className="drag-drop-badge">.TIF / .TIFF</span>
          <span className="drag-drop-badge">Float32 / Int16</span>
          <span className="drag-drop-badge">WGS84 &amp; UTM Projected</span>
        </div>
      </div>
    </div>
  );
};
