'use client';

import "@livekit/components-styles";
import { useTranscriptions } from "@livekit/components-react";

export default function Captions() {
    const transcriptions = useTranscriptions();

    const captions = transcriptions.slice(-2);

    if (!captions.length) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 text-center">
            {captions.map((caption, index) => (
                <div
                    key={index}
                    className="animate-in fade-in duration-300"
                >
                    <span>
                        {caption.participantInfo?.identity ?? "Unknown"}:{" "}
                        {caption.text}
                    </span>
                </div>
            ))}
        </div>
    );
}