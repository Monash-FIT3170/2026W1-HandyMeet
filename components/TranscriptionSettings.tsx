'use client';

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
  const update = (partial: Partial<CaptionSettings>) =>
    onChange({ ...settings, ...partial });

  const reset = () => onChange({ ...defaultCaptionSettings });

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
                onClick={() => update({ textColor: preset.value })}
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
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => update({ textColor: e.target.value })}
              title="Custom colour"
              style={styles.colorInput}
            />
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
