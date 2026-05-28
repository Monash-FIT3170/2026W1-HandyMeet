'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const inputClass =
  'w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 text-[15px] outline-none focus:border-primary-500 transition-colors placeholder:text-neutral-600';

export default function JoinForm() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  function joinRoom(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    if (!roomCode.trim()) {
      // Create a random room code and join that room
      const code = generateRoomCode();
      router.push(
        `/room/${code}?username=${encodeURIComponent(username.trim())}`,
      );
    } else {
      // Join the specified room
      router.push(
        `/room/${encodeURIComponent(roomCode.trim())}?username=${encodeURIComponent(username.trim())}`,
      );
    }
  }

  const canAct = username.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div
        className="relative lg:w-1/2 flex flex-col justify-between overflow-hidden p-12"
        style={{ backgroundColor: '#10599A' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
          style={{ backgroundColor: '#DB4C77' }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: '#E8EEF5' }}
        />
        <div
          className="absolute top-1/2 right-8 w-40 h-40 rounded-full opacity-25 -translate-y-1/2"
          style={{ backgroundColor: '#DB4C77' }}
        />

        {/* Wordmark */}
        <div className="relative z-10">
          <span
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: '#CFDDEB' }}
          >
            HandyMeet
          </span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 my-auto py-16">
          <h1
            className="text-6xl xl:text-7xl font-bold leading-[1.05] mb-6"
            style={{ color: '#E8EEF5' }}
          >
            Video
            <br />
            conferencing
            <br />
            <span style={{ color: '#F1B7C9' }}>hands-on.</span>
          </h1>
          <p style={{ color: '#9FBB97', fontSize: '1.05rem' }}>
            Gesture-powered meetings, made for everyone.
          </p>
        </div>
      </div>

      <div className="lg:w-1/2 bg-neutral-900 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h2 className="text-2xl font-bold text-neutral-100">HandyMeet</h2>
            <p className="text-neutral-600 text-sm mt-1">
              Gesture-powered video conferencing
            </p>
          </div>

          <h2 className="text-xl font-bold text-neutral-100 mb-1">
            Get started
          </h2>
          <p className="text-neutral-600 text-sm mb-8">
            Join an existing room or create your own.
          </p>

          <div className="flex flex-col gap-3">
            <input
              className={inputClass}
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              autoComplete="off"
            />

            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1 min-w-0`}
                type="text"
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={20}
                autoComplete="off"
              />
            </div>

            <button
              type="button"
              disabled={!canAct}
              onClick={joinRoom}
              className="w-full rounded-lg px-5 py-3 text-[15px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: '#DB4C77', color: '#FCEEF2' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#E88DA8')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = '#DB4C77')
              }
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
