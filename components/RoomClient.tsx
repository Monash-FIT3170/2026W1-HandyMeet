'use client';

import '@livekit/components-styles';
import { LiveKitRoom } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MeetingRoom from '@/components/meeting/MeetingRoom';
import Captions from '@/components/Captions';

export default function RoomClient({
  roomName,
  username,
}: {
  roomName: string;
  username: string;
}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

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
        <p className="text-red-500">{error}</p>
        <button
          className="text-emerald-500 border border-emerald-500 rounded-lg px-5 py-2 text-[15px] font-semibold cursor-pointer hover:bg-emerald-500 hover:text-white transition-colors"
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

  return (
    <main className="h-screen" data-lk-theme="default">
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={token}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={() => router.push('/')}
      >
        <MeetingRoom />
        <div className="absolute bottom-24 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-black/60 text-white p-4 rounded-lg max-w-2xl pointer-events-auto">
            <Captions />
          </div>
        </div>
      </LiveKitRoom>
    </main>
  );
}
