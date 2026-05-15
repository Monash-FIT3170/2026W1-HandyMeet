'use client';

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
    <div
      style={{
        width: '18rem',
        zIndex: 50,
        backgroundColor: 'var(--lk-bg2, #1a1a2e)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: 'white',
        fontSize: '0.875rem',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
      >
        <span>Caption Settings</span>
        <button
          onClick={onClose}
          title="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            padding: '0.25rem',
            lineHeight: 1,
          }}
        >
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
      <div
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Show/Hide Captions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ opacity: 0.8 }}>Show Captions</span>
          <button
            onClick={() => update({ visible: !settings.visible })}
            style={{
              width: '3rem',
              height: '1.5rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              backgroundColor: settings.visible
                ? 'var(--lk-accent-bg, #10b981)'
                : 'rgba(255,255,255,0.2)',
              transition: 'background-color 0.2s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '4px',
                left: settings.visible ? 'calc(100% - 20px)' : '4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'white',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </button>
        </div>

        {/* Font Size */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
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
            style={{
              width: '100%',
              accentColor: 'var(--lk-accent-bg, #10b981)',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              opacity: 0.3,
              fontSize: '0.7rem',
            }}
          >
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>

        {/* Text Colour */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <span style={{ opacity: 0.8 }}>Caption Colour</span>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {TEXT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.label}
                onClick={() => update({ textColor: preset.value })}
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '50%',
                  border: `2px solid ${settings.textColor === preset.value ? 'white' : 'rgba(255,255,255,0.2)'}`,
                  backgroundColor: preset.value,
                  cursor: 'pointer',
                  transform:
                    settings.textColor === preset.value
                      ? 'scale(1.15)'
                      : 'scale(1)',
                  transition: 'transform 0.15s, border-color 0.15s',
                }}
              />
            ))}
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => update({ textColor: e.target.value })}
              title="Custom colour"
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)',
                padding: 0,
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
            />
          </div>
        </div>

        {/* Background Colour */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <span style={{ opacity: 0.8 }}>Background Colour</span>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {BG_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.label}
                onClick={() => update({ bgColor: preset.value })}
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '50%',
                  border: `2px solid ${settings.bgColor === preset.value ? 'white' : 'rgba(255,255,255,0.2)'}`,
                  backgroundColor:
                    preset.value === 'rgba(0,0,0,0)'
                      ? 'transparent'
                      : preset.value,
                  cursor: 'pointer',
                  transform:
                    settings.bgColor === preset.value
                      ? 'scale(1.15)'
                      : 'scale(1)',
                  transition: 'transform 0.15s, border-color 0.15s',
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
          style={{ width: '100%', justifyContent: 'center', opacity: 0.7 }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
