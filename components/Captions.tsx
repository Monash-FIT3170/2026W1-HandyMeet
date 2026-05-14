'use client';

import "@livekit/components-styles";
import { useTranscriptions } from "@livekit/components-react";
import { useState } from 'react';

export default function Captions() {

    const [expandCaptions, setExpandCaptions] = useState(false);
    const [displayCaptions, setDisplayCaptions] = useState(true);

    const transcriptions = useTranscriptions();

    const captions = expandCaptions ? transcriptions.slice(-8) : transcriptions.slice(-2);

    if (!captions.length) {
        return null;
    }

    const setCaptions = () => {
    if (displayCaptions) {
      setDisplayCaptions(false);
      setExpandCaptions(false);
    } else {
      setDisplayCaptions(true);
    }
  };

    return (
        <div className="w-[500px] fixed bottom-20 left-1/2 -translate-x-1/2">
            <div className="flex gap-2 w-full mb-2 self-start items-center px-1">
                <button 
                    onClick={setCaptions}
                    className="px-2 h-6 flex items-center justify-center rounded bg-white/20 text-[15px] font-bold tracking-wider hover:bg-white/30 transition text-white"
                >
                    {displayCaptions ? 'Hide' : 'CC: Show'}
                </button>
                {displayCaptions && (
                    <button 
                        onClick={() => setExpandCaptions(!expandCaptions)}
                        className="px-2 h-6 flex items-center justify-center rounded bg-white/20 text-[15px] font-bold tracking-wider hover:bg-white/30 transition text-white"
                    >
                            {expandCaptions ? '-' : '+'}
                </button>
                )}
            </div>
            <div
                className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                    displayCaptions ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
            >
                <div className={`bg-black/60 flex flex-col gap-2 text-center ${expandCaptions ? 'h-64 overflow-y-auto' : 'h-auto overflow-hidden'}`}>
                    {captions.map((caption, index) => {
                        const isLatest = index === captions.length - 1;
                        return (
                            <div
                                key={index}
                                className={`animate-in fade-in duration-300 ${isLatest ? 'font-bold text-lg' : 'opacity-60 text-lg'}`}
                            >
                                <span>
                                    {caption.participantInfo?.identity ?? "Unknown"}:{" "}
                                    {caption.text}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}