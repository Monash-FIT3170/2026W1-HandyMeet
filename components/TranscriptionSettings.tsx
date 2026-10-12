'use client';

import { useState } from 'react';
import { styles } from './TranscriptionSettings.style';

export type CaptionSettings = {
  visible: boolean;
  fontSize: number;
  textColor: string;
  bgColor: string;
};

export const defaultCaptionSettings: CaptionSettings = {
  visible: true,
  fontSize: 18,
  textColor: '#ffffff',
  bgColor: 'rgba(0,0,0,0.65)',
};

const TEXT_COLOR_PRESETS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Cyan', value: '#22d3ee' },
  { label: 'Lime', value: '#a3e635' },
  { label: 'Orange', value: '#fb923c' },
];

const BG_COLOR_PRESETS = [
  { label: 'Dark', value: 'rgba(0,0,0,0.65)' },
  { label: 'Black', value: 'rgba(0,0,0,0.9)' },
  { label: 'Navy', value: 'rgba(15,23,42,0.8)' },
  { label: 'None', value: 'rgba(0,0,0,0)' },
];

// White has no saturation, so moving only the native picker's hue slider
// leaves the selected colour white. Start it at the saturated end instead.
const pickerStartColor = (color: string) =>
  color.toLowerCase() === '#ffffff' ? '#ff0000' : color;

type Props = {
  settings: CaptionSettings;
  onChange: (settings: CaptionSettings) => void;
  open: boolean;
  onClose: () => void;
};

export default function TranscriptionSettings({
  settings,
  onChange,
  open,
  onClose,
}: Props) {
  const [pickerColor, setPickerColor] = useState(() =>
    pickerStartColor(settings.textColor),
  );
  const update = (partial: Partial<CaptionSettings>) =>
    onChange({ ...settings, ...partial });

  const reset = () => {
    setPickerColor(pickerStartColor(defaultCaptionSettings.textColor));
    onChange({ ...defaultCaptionSettings });
  };

  if (!open) return null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span>Caption Settings</span>
        <button onClick={onClose} title="Close" style={styles.closeButton}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* Show/Hide Captions */}
        <div style={styles.rowBetween}>
          <span style={{ opacity: 0.8 }}>Show Captions</span>
          <button
            onClick={() => update({ visible: !settings.visible })}
            style={{
              ...styles.toggle,
              backgroundColor: settings.visible
                ? 'var(--lk-accent-bg, #10b981)'
                : 'rgba(255,255,255,0.2)',
            }}
          >
            <span
              style={{
                ...styles.toggleKnob,
                left: settings.visible ? 'calc(100% - 20px)' : '4px',
              }}
            />
          </button>
        </div>

        {/* Font Size */}
        <div style={styles.columnSmall}>
          <div style={styles.rowBetween}>
            <span style={{ opacity: 0.8 }}>Caption Size</span>
            <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>
              {settings.fontSize}px
            </span>
          </div>
          <input
            type="range"
            min={12}
            max={36}
            step={2}
            value={settings.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>

        {/* Text Colour */}
        <div style={styles.columnMedium}>
          <span style={{ opacity: 0.8 }}>Caption Colour</span>
          <div style={styles.colorRow}>
            {TEXT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.label}
                onClick={() => {
                  setPickerColor(pickerStartColor(preset.value));
                  update({ textColor: preset.value });
                }}
                style={{
                  ...styles.colorButton,
                  border: `2px solid ${settings.textColor === preset.value ? 'white' : 'rgba(255,255,255,0.2)'}`,
                  backgroundColor: preset.value,
                  transform:
                    settings.textColor === preset.value
                      ? 'scale(1.15)'
                      : 'scale(1)',
                }}
              />
            ))}
            <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/40 focus-within:ring-2 focus-within:ring-white">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background:
                    'conic-gradient(#ef4444, #facc15, #22c55e, #3b82f6, #a855f7, #ef4444)',
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                >
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path d="M14.5 6.5 17 9" />
                  <path d="M11 9 15 5l4 4-4 4" />
                  <path d="m16 4 2-2 4 4-2 2" />
                </svg>
              </span>
              <input
                type="color"
                aria-label="Choose custom caption colour"
                value={pickerColor}
                onChange={(e) => {
                  setPickerColor(e.target.value);
                  update({ textColor: e.target.value });
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        {/* Background Colour */}
        <div style={styles.columnMedium}>
          <span style={{ opacity: 0.8 }}>Background Colour</span>
          <div style={styles.colorRow}>
            {BG_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.label}
                onClick={() => update({ bgColor: preset.value })}
                style={{
                  ...styles.colorButton,

                  border: `2px solid ${settings.bgColor === preset.value ? 'white' : 'rgba(255,255,255,0.2)'}`,
                  backgroundColor:
                    preset.value === 'rgba(0,0,0,0)'
                      ? 'transparent'
                      : preset.value,
                  transform:
                    settings.bgColor === preset.value
                      ? 'scale(1.15)'
                      : 'scale(1)',
                  outline:
                    preset.value === 'rgba(0,0,0,0)'
                      ? '1px dashed rgba(255,255,255,0.3)'
                      : 'none',
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {preset.value === 'rgba(0,0,0,0)' ? '∅' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={reset}
          className="lk-button"
          style={styles.resetButton}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
