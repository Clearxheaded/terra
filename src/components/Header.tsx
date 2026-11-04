import React from 'react';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';

interface HeaderProps {
  grid: ElevationGrid | null;
}

export const Header: React.FC<HeaderProps> = ({ grid }) => {
  const stats = grid?.getStats();

  return (
    <header className="app-header">
      <div className="brand-section">
        <h1 className="brand-title">TERRA</h1>
        <span className="brand-tag">v0.1.0 • Release</span>
      </div>

      <div className="header-meta">
        {grid ? (
          <>
            <div className="header-meta-item">
              <span>Dataset:</span>
              <span className="header-meta-value">{grid.datasetName}</span>
            </div>
            <div className="header-meta-item">
              <span>Grid:</span>
              <span className="header-meta-value">
                {grid.width} &times; {grid.height} px
              </span>
            </div>
            {stats && (
              <div className="header-meta-item">
                <span>Elev:</span>
                <span className="header-meta-value">
                  {stats.min.toFixed(0)}m &ndash; {stats.max.toFixed(0)}m
                </span>
              </div>
            )}
          </>
        ) : (
          <span>No terrain loaded</span>
        )}
      </div>
    </header>
  );
};

