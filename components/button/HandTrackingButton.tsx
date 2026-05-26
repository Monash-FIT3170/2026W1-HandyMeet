import { useState } from 'react';

type HandTrackingButtonProps = {
  trackingEnabled: boolean;
  overlayEnabled: boolean;
  isTracking: boolean;
  isCameraEnabled: boolean;
  onToggleTracking: () => void;
  onToggleOverlay: () => void;
};

export default function HandTrackingButton({
  trackingEnabled,
  overlayEnabled,
  isTracking,
  isCameraEnabled,
  onToggleTracking,
  onToggleOverlay,
}: HandTrackingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="lk-button"
        aria-pressed={trackingEnabled}
        onClick={() => setOpen((prev) => !prev)}
        title="Gestures"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
        Gestures
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 0.75rem)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgb(var(--color-neutral-900-rgb, 0 0 0) / 0.95)',
            backgroundColor: 'var(--lk-bg-2)',
            border: '1px solid var(--lk-border-color)',
            borderRadius: '0.75rem',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            width: '11rem',
            boxShadow: '0 8px 32px rgb(0 0 0 / 0.5)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Tracking toggle */}
          <button
            onClick={onToggleTracking}
            disabled={!isCameraEnabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: trackingEnabled
                ? `rgb(var(--color-primary-900-rgb) / 0.2)`
                : 'transparent',
              color: trackingEnabled
                ? 'var(--color-primary-500)'
                : 'var(--color-neutral-400)',
              cursor: isCameraEnabled ? 'pointer' : 'not-allowed',
              opacity: isCameraEnabled ? 1 : 0.4,
              fontSize: '0.8rem',
              fontWeight: 500,
              transition: 'background 0.15s, color 0.15s',
              width: '100%',
            }}
          >
            <span>Hand tracking</span>
            {/* Toggle pill */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: '1.75rem',
                height: '1rem',
                borderRadius: '999px',
                background: trackingEnabled
                  ? 'var(--color-primary-900)'
                  : `rgb(var(--color-neutral-300-rgb) / 0.12)`,
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: trackingEnabled ? '0.85rem' : '0.1rem',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  background: 'var(--color-neutral-100)',
                  transition: 'left 0.2s',
                }}
              />
            </span>
          </button>

          {/* Overlay toggle */}
          <button
            onClick={onToggleOverlay}
            disabled={!trackingEnabled || !isCameraEnabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: overlayEnabled
                ? `rgb(var(--color-primary-900-rgb) / 0.2)`
                : 'transparent',
              color: overlayEnabled
                ? 'var(--color-primary-500)'
                : 'var(--color-neutral-400)',
              cursor:
                trackingEnabled && isCameraEnabled ? 'pointer' : 'not-allowed',
              opacity: trackingEnabled && isCameraEnabled ? 1 : 0.4,
              fontSize: '0.8rem',
              fontWeight: 500,
              transition: 'background 0.15s, color 0.15s',
              width: '100%',
            }}
          >
            <span>Show overlay</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: '1.75rem',
                height: '1rem',
                borderRadius: '999px',
                background: overlayEnabled
                  ? 'var(--color-primary-900)'
                  : `rgb(var(--color-neutral-300-rgb) / 0.12)`,
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: overlayEnabled ? '0.85rem' : '0.1rem',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  background: 'var(--color-neutral-100)',
                  transition: 'left 0.2s',
                }}
              />
            </span>
          </button>

          {/* Status indicator */}
          {trackingEnabled && (
            <>
              <div
                style={{
                  height: '1px',
                  background: 'var(--lk-border-color)',
                  margin: '0.15rem 0.25rem',
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  color: isTracking
                    ? 'var(--color-primary-300)'
                    : 'var(--color-neutral-600)',
                }}
              >
                <span
                  style={{
                    width: '0.45rem',
                    height: '0.45rem',
                    borderRadius: '50%',
                    background: isTracking
                      ? 'var(--color-primary-300)'
                      : 'var(--color-neutral-600)',
                    flexShrink: 0,
                    boxShadow: isTracking
                      ? '0 0 6px var(--color-primary-300)'
                      : 'none',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }}
                />
                {isTracking ? 'Hand detected' : 'No hand detected'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
