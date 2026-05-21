'use client';

export const styles = {
  container: {
    width: '18rem',
    zIndex: 50,
    backgroundColor: 'var(--lk-bg2, #1a1a2e)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '0.75rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: 'white',
    fontSize: '0.875rem',
    overflow: 'hidden',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },

  body: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },

  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  columnSmall: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },

  columnMedium: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },

  colorRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)',
    padding: '0.25rem',
    lineHeight: 1,
  },

  slider: {
    width: '100%',
    accentColor: 'var(--lk-accent-bg, #10b981)',
  },

  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    opacity: 0.3,
    fontSize: '0.7rem',
  },

  toggle: {
    width: '3rem',
    height: '1.5rem',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
  },

  toggleKnob: {
    position: 'absolute',
    top: '4px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },

  colorButton: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'transform 0.15s, border-color 0.15s',
  },

  colorInput: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    padding: 0,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },

  resetButton: {
    width: '100%',
    justifyContent: 'center',
    opacity: 0.7,
  },
} as const;
