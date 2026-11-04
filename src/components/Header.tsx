import React, { useState } from 'react';
import type { ElevationGrid } from '@/lib/geospatial/elevation-grid';
import { IconClose, IconKeyboard } from './common/Icons';

interface HeaderProps {
  grid: ElevationGrid | null;
}

export const Header: React.FC<HeaderProps> = ({ grid }) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const stats = grid?.getStats();

  return (
    <>
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

        <div className="header-actions">
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={() => setShowShortcuts((prev) => !prev)}
            title="Keyboard shortcuts & controls guide"
            style={{ fontSize: '0.75rem', gap: '0.35rem', display: 'flex', alignItems: 'center' }}
          >
            <IconKeyboard size={14} />
            <span>Shortcuts</span>
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Dialog Modal */}
      {showShortcuts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              background: 'var(--bg-glass-strong)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconKeyboard size={16} className="text-emerald" />
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={() => setShowShortcuts(false)}
                style={{ padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <IconClose size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                }}
              >
                Layer Switching
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.45rem',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Elevation</span>
                  <kbd>1</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Slope</span>
                  <kbd>2</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Aspect</span>
                  <kbd>3</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Hillshade</span>
                  <kbd>4</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>D8 Flow</span>
                  <kbd>5</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Accumulation</span>
                  <kbd>6</kbd>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  marginTop: '0.5rem',
                }}
              >
                Camera &amp; Navigation
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.45rem',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Top-Down (2D)</span>
                  <kbd>T</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>45° Isometric</span>
                  <kbd>I</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Oblique View</span>
                  <kbd>O</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Reset Camera</span>
                  <kbd>R</kbd>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  marginTop: '0.5rem',
                }}
              >
                Analysis Tools
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.45rem',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>2D Profile Transect</span>
                  <kbd>P</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Cancel / Dismiss</span>
                  <kbd>Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
