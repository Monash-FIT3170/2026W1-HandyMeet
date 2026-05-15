'use client';

import '@livekit/components-styles';
import { useTranscriptions } from '@livekit/components-react';
import { useState } from 'react';
import type { CaptionSettings } from './TranscriptionSettings';

type Props = {
  settings: CaptionSettings;
};

export default function Captions({ settings }: Props) {
  const [expandCaptions, setExpandCaptions] = useState(false);

  const transcriptions = useTranscriptions();

  const captions = expandCaptions
    ? transcriptions.slice(-8)
    : transcriptions.slice(-2);

  if (!captions.length) {
    return null;
  }

  if (!settings.visible) {
    return (
      <div className="w-[500px] fixed bottom-20 left-1/2 -translate-x-1/2">
        <div className="flex gap-2 w-full mb-2 self-start items-center px-1">
          <span className="px-2 h-6 flex items-center justify-center rounded bg-white/20 text-[13px] font-bold tracking-wider text-white/50 select-none">
            CC: Hidden
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[500px] fixed bottom-20 left-1/2 -translate-x-1/2">
      <div className="flex gap-2 w-full mb-2 self-start items-center px-1">
        <button
          onClick={() => setExpandCaptions(!expandCaptions)}
          className="px-2 h-6 flex items-center justify-center rounded bg-white/20 text-[13px] font-bold tracking-wider hover:bg-white/30 transition text-white"
        >
          {expandCaptions ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div
        className={`flex flex-col gap-2 text-center rounded-lg px-3 py-2 ${expandCaptions ? 'h-64 overflow-y-auto' : 'h-auto overflow-hidden'}`}
        style={{ backgroundColor: settings.bgColor }}
      >
        {captions.map((caption, index) => {
          const isLatest = index === captions.length - 1;
          return (
            <div
              key={index}
              className={`animate-in fade-in duration-300 ${isLatest ? 'font-bold' : 'opacity-60'}`}
              style={{
                fontSize: `${settings.fontSize}px`,
                color: settings.textColor,
              }}
            >
              <span>
                {caption.participantInfo?.identity ?? 'Unknown'}: {caption.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
