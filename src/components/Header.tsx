import React, { useEffect, useRef, useState } from 'react';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import type { SyntheticTerrainOptions } from '@/lib/geospatial/synthetic-terrain';
import {
  IconChevronDown,
  IconClose,
  IconFolderUp,
  IconKeyboard,
  IconTerraMark,
} from './common/Icons';

interface HeaderProps {
  grid: ElevationGrid | null;
  onFileUpload: (file: File) => void;
  onLoadSampleFile: (url?: string, title?: string) => void;
  onLoadSynthetic: (type: SyntheticTerrainOptions['type']) => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  grid,
  onFileUpload,
  onLoadSampleFile,
  onLoadSynthetic,
  isLoading,
}) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stats = grid?.getStats();

  useEffect(() => {
    if (!showDatasetMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDatasetMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDatasetMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [showDatasetMenu]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      setShowDatasetMenu(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-logo" aria-hidden="true">
            <IconTerraMark size={17} />
          </span>
          <h1 className="brand-title">TERRA</h1>
          <span className="brand-tag">0.1.0 &middot; Release</span>
        </div>

        <div className="header-center">
          <div className="dataset-switcher" ref={menuRef}>
            <button
              type="button"
              className="dataset-switcher-btn"
              onClick={() => setShowDatasetMenu((prev) => !prev)}
              aria-expanded={showDatasetMenu}
              aria-haspopup="menu"
              title="Switch terrain dataset or import GeoTIFF"
            >
              <span className="header-meta">
                {grid ? (
                  <>
                    <span className="header-meta-value dataset-name-text">{grid.datasetName}</span>
                    <span className="header-meta-sep">/</span>
                    <span className="header-meta-value">
                      {grid.width} &times; {grid.height} px
                    </span>
                    {stats && (
                      <>
                        <span className="header-meta-sep">/</span>
                        <span className="header-meta-value">
                          {stats.min.toFixed(0)}&ndash;{stats.max.toFixed(0)} m
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span>Select terrain dataset</span>
                )}
              </span>
              <IconChevronDown size={13} className="text-muted" />
            </button>

            {showDatasetMenu && (
              <div className="dataset-menu" role="menu">
                <div className="dataset-menu-group-label">Sample DEMs</div>
                <button
                  type="button"
                  role="menuitem"
                  className="dataset-menu-item"
                  disabled={isLoading}
                  onClick={() => {
                    onLoadSampleFile('samples/mount_st_helens.tif', 'Mount St. Helens (USGS 3DEP 30m)');
                    setShowDatasetMenu(false);
                  }}
                >
                  <span>Mount St. Helens</span>
                  <span className="dataset-menu-meta">128&times;128 &middot; 30m UTM</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dataset-menu-item"
                  disabled={isLoading}
                  onClick={() => {
                    onLoadSampleFile('samples/drainage_basin.tif', 'Eagle Creek Basin (30m UTM)');
                    setShowDatasetMenu(false);
                  }}
                >
                  <span>Eagle Creek Basin</span>
                  <span className="dataset-menu-meta">128&times;128 &middot; Sinks</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="dataset-menu-item"
                  disabled={isLoading}
                  onClick={() => {
                    onLoadSampleFile('samples/sample_dem.tif', 'Sample Volcanic Peak (30m UTM)');
                    setShowDatasetMenu(false);
                  }}
                >
                  <span>Volcanic Peak</span>
                  <span className="dataset-menu-meta">35&times;35 &middot; 30m UTM</span>
                </button>

                <div className="dataset-menu-divider" />
                <div className="dataset-menu-group-label">Synthetic Terrains</div>
                <div className="dataset-menu-synthetic-row">
                  {(['mountain', 'valley', 'pyramid', 'plane', 'depression'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="button button-sm"
                      onClick={() => {
                        onLoadSynthetic(t);
                        setShowDatasetMenu(false);
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="dataset-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="dataset-menu-item dataset-menu-import"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <IconFolderUp size={13} />
                    <span>Import local GeoTIFF (.tif)…</span>
                  </span>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".tif,.tiff,.geotiff"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={() => setShowShortcuts((prev) => !prev)}
            title="Keyboard shortcuts & controls guide"
          >
            <IconKeyboard size={14} />
            <span>Shortcuts</span>
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="modal-backdrop"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconKeyboard size={15} className="text-accent" />
                <h3 className="modal-title">Keyboard Shortcuts</h3>
              </div>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
              >
                <IconClose size={14} />
              </button>
            </div>

            <div className="shortcuts-body">
              <div className="shortcuts-group-title">Surface Layers</div>
              <div className="shortcuts-grid">
                <div className="shortcut-row"><span>Elevation</span><kbd>1</kbd></div>
                <div className="shortcut-row"><span>Slope</span><kbd>2</kbd></div>
                <div className="shortcut-row"><span>Aspect</span><kbd>3</kbd></div>
                <div className="shortcut-row"><span>Hillshade</span><kbd>4</kbd></div>
                <div className="shortcut-row"><span>D8 Flow</span><kbd>5</kbd></div>
                <div className="shortcut-row"><span>Accumulation</span><kbd>6</kbd></div>
              </div>

              <div className="shortcuts-group-title">Camera &amp; Viewport</div>
              <div className="shortcuts-grid">
                <div className="shortcut-row"><span>Top-Down (2D)</span><kbd>T</kbd></div>
                <div className="shortcut-row"><span>45° Isometric</span><kbd>I</kbd></div>
                <div className="shortcut-row"><span>Oblique View</span><kbd>O</kbd></div>
                <div className="shortcut-row"><span>Reset Camera</span><kbd>R</kbd></div>
                <div className="shortcut-row"><span>Fullscreen</span><kbd>F</kbd></div>
              </div>

              <div className="shortcuts-group-title">Analysis Tools</div>
              <div className="shortcuts-grid">
                <div className="shortcut-row"><span>2D Profile Transect</span><kbd>P</kbd></div>
                <div className="shortcut-row"><span>Cancel / Dismiss</span><kbd>Esc</kbd></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
