'use client';

import { useEffect, useRef, useState } from 'react';

export default function RoomCodeButton({ roomCode }: { roomCode: string }) {
  const [result, setResult] = useState<'copied' | 'failed'>('copied');
  const [showResult, setShowResult] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setResult('copied');
    } catch {
      setResult('failed');
    }
    setShowResult(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowResult(false), 2000);
  }

  const resultText = result === 'copied' ? 'Copied!' : 'Failed';
  const showCode = (hovered || focused) && !showResult;
  const showLabel = !showCode && !showResult;

  const layer = (visible: boolean): React.CSSProperties => ({
    gridArea: '1 / 1',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.15s',
    textAlign: 'center',
  });

  return (
    <button
      type="button"
      className="lk-button"
      onClick={copyCode}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      title="Copy meeting code"
      aria-label={`Meeting room code ${roomCode}. Click to copy.`}
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
        aria-hidden="true"
      >
        <rect width="14" height="14" x="8" y="8" rx="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>

      {/* Three layers share one grid cell so the button never resizes */}
      <span style={{ display: 'grid' }} aria-hidden="true">
        <span style={layer(showLabel)}>Code</span>
        <span
          style={{
            ...layer(showCode),
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
          }}
        >
          {roomCode}
        </span>
        <span style={layer(showResult)}>{resultText}</span>
      </span>

      {/* Screen-reader announcement for copy result */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {showResult ? resultText : ''}
      </span>
    </button>
  );
}
