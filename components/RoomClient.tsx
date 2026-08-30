'use client';

import '@livekit/components-styles';
import { LiveKitRoom } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MeetingRoom from '@/components/meeting/MeetingRoom';
import Captions from '@/components/Captions';
import TranscriptSummary from '@/components/TranscriptSummary';
import {
  defaultCaptionSettings,
  type CaptionSettings,
} from '@/components/TranscriptionSettings';
import GestureReactionsBanner from './GestureReactionsBanner';
import Whiteboard from '@/components/Whiteboard';

export default function RoomClient({
  roomName,
  username,
}: {
  roomName: string;
  username: string;
}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(
    defaultCaptionSettings,
  );
  const [callPhase, setCallPhase] = useState<'active' | 'ended'>('active');
  const [transcriptSnapshot, setTranscriptSnapshot] = useState<string[]>([]);
  const isLeavingRef = useRef(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const handleLeave = useCallback((transcriptLines: string[]) => {
    isLeavingRef.current = true;
    setTranscriptSnapshot(transcriptLines);
    setCallPhase('ended');
  }, []);

  const handleDisconnected = useCallback(() => {
    if (isLeavingRef.current) return;
    router.push('/');
  }, [router]);

  useEffect(() => {
    async function getToken() {
      try {
        const res = await fetch(
          `/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`,
        );
        if (!res.ok) throw new Error('Token request failed');
        const data = (await res.json()) as { token: string };
        setToken(data.token);
      } catch {
        setError('Failed to connect to room. Please try again.');
      }
    }
    getToken();
  }, [roomName, username]);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-secondary-900">{error}</p>
        <button
          className="text-primary-500 border border-primary-500 rounded-lg px-5 py-2 text-[15px] font-semibold cursor-pointer hover:bg-primary-900 hover:text-neutral-100 transition-colors"
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-500">Connecting...</p>
      </div>
    );
  }

  if (callPhase === 'ended') {
    return (
      <main className="h-screen" data-lk-theme="default">
        <TranscriptSummary
          transcript={transcriptSnapshot}
          onClose={() => router.push('/')}
        />
      </main>
    );
  }

  return (
    <main className="h-screen" data-lk-theme="default">
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={token}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={handleDisconnected}
      >
        <GestureReactionsBanner />

        <MeetingRoom
          captionSettings={captionSettings}
          onCaptionSettingsChange={setCaptionSettings}
          onLeave={handleLeave}
          whiteboardOpen={whiteboardOpen}
          onToggleWhiteboard={() => setWhiteboardOpen((prev) => !prev)}
          onLocalVideoRef={(video) => {
            localVideoRef.current = video;
          }}
        />
        <Captions
          settings={captionSettings}
          position={whiteboardOpen ? 'whiteboard' : 'default'}
        />

        <Whiteboard
          isOpen={whiteboardOpen}
          onClose={() => setWhiteboardOpen(false)}
          captionSettings={captionSettings}
          onCaptionSettingsChange={setCaptionSettings}
          localVideoRef={localVideoRef}
        />
      </LiveKitRoom>
    </main>
  );
}
