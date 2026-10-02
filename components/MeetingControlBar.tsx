'use client';

import { useState } from 'react';
import { ControlBar, useLocalParticipant } from '@livekit/components-react';
import TranscriptionSettings, {
  type CaptionSettings,
} from '@/components/TranscriptionSettings';
import HandTrackingButton from './button/HandTrackingButton';
import type { MeetingControls } from './meeting/MeetingRoom';

type MeetingControlBarProps = MeetingControls & {
  captionSettings: CaptionSettings;
  onCaptionSettingsChange: (settings: CaptionSettings) => void;
  whiteboardOpen: boolean;
  onToggleWhiteboard: () => void;
};

export default function MeetingControlBar({
  captionSettings,
  onCaptionSettingsChange,
  whiteboardOpen,
  onToggleWhiteboard,
  trackingEnabled,
  overlayEnabled,
  isTracking,
  onToggleTracking,
  onToggleOverlay,
  insightsEnabled,
  onToggleInsights,
  onLeave,
}: MeetingControlBarProps) {
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const { isCameraEnabled } = useLocalParticipant();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.75rem',
        position: whiteboardOpen ? 'fixed' : 'relative',
        bottom: whiteboardOpen ? 0 : undefined,
        left: whiteboardOpen ? 0 : undefined,
        right: whiteboardOpen ? 0 : undefined,
        height: '64px',
        flexShrink: 0,
        zIndex: 60,
        background: '#171717',
      }}
    >
      {/* Gradient accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background:
            'linear-gradient(90deg, transparent 0%, #10599A 20%, #7099C2 50%, #DB4C77 80%, transparent 100%)',
          opacity: 0.9,
        }}
      />

      {/* Left spacer */}
      <div style={{ flex: 1 }} />

      {/* Centre pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          borderRadius: '999px',
          padding: '0.3rem 0.5rem',
        }}
      >
        <ControlBar
          controls={{
            microphone: true,
            camera: true,
            screenShare: true,
            chat: !whiteboardOpen,
            settings: false,
            leave: false,
          }}
          style={{
            border: 'none',
            padding: 0,
            gap: '0.25rem',
            display: 'contents',
          }}
        />

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '1.5rem',
            background: 'rgba(255,255,255,0.08)',
            margin: '0 0.25rem',
            flexShrink: 0,
          }}
        />

        {/* Captions */}
        <div style={{ position: 'relative' }}>
          {captionsOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 0.75rem)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
              }}
            >
              <TranscriptionSettings
                settings={captionSettings}
                onChange={onCaptionSettingsChange}
                open={captionsOpen}
                onClose={() => setCaptionsOpen(false)}
              />
            </div>
          )}
          <button
            className="lk-button"
            aria-pressed={captionsOpen}
            onClick={() => setCaptionsOpen((v) => !v)}
            title="Captions"
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
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M8 10.5h4" />
              <path d="M14 10.5h4" />
              <path d="M8 14.5h4" />
              <path d="M14 14.5h2" />
            </svg>
            Captions
          </button>
        </div>

        {/* Whiteboard */}
        <button
          className="lk-button"
          aria-pressed={whiteboardOpen}
          onClick={onToggleWhiteboard}
          title="Whiteboard"
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
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          Whiteboard
        </button>

        {!whiteboardOpen && (
          <>
            {/* Gestures */}
            <HandTrackingButton
              trackingEnabled={trackingEnabled}
              overlayEnabled={overlayEnabled}
              isTracking={isTracking}
              isCameraEnabled={isCameraEnabled}
              onToggleTracking={onToggleTracking}
              onToggleOverlay={onToggleOverlay}
            />

            {/* Live insights */}
            <button
              className="lk-button"
              aria-pressed={insightsEnabled}
              onClick={onToggleInsights}
              title="Live insights"
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
                <path d="M12 3v2" />
                <path d="M12 19v2" />
                <path d="M5 5l1.5 1.5" />
                <path d="M17.5 17.5L19 19" />
                <path d="M5 19l1.5-1.5" />
                <path d="M17.5 6.5L19 5" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              Insights
            </button>
          </>
        )}
      </div>

      {/* Right  Leave */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onLeave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1.1rem',
            borderRadius: '999px',
            border: '1px solid rgba(219,76,119,0.3)',
            background: 'rgba(219,76,119,0.12)',
            color: '#E88DA8',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = 'rgba(219,76,119,0.28)';
            b.style.borderColor = 'rgba(219,76,119,0.6)';
            b.style.color = '#FCEEF2';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = 'rgba(219,76,119,0.12)';
            b.style.borderColor = 'rgba(219,76,119,0.3)';
            b.style.color = '#E88DA8';
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Leave
        </button>
      </div>
    </div>
  );
}
