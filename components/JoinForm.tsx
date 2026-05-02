'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const inputClass =
  'w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-neutral-100 text-[15px] outline-none focus:border-emerald-500 transition-colors placeholder:text-neutral-500';

export default function JoinForm() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  function joinRoom(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) return;
    router.push(
      `/room/${encodeURIComponent(roomCode.trim())}?username=${encodeURIComponent(username.trim())}`,
    );
  }

  function createRoom() {
    if (!username.trim()) return;
    const code = generateRoomCode();
    router.push(
      `/room/${code}?username=${encodeURIComponent(username.trim())}`,
    );
  }

  const canAct = username.trim().length > 0;
  const canJoin = canAct && roomCode.trim().length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-10 w-full max-w-md">
        <h1 className="text-4xl font-bold tracking-tight mb-1">HandyMeet</h1>
        <p className="text-neutral-500 text-sm mb-8">
          Video conferencing, made accessible.
        </p>

        <form onSubmit={joinRoom} className="flex flex-col gap-3">
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
              placeholder="Room code (optional)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={20}
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-emerald-500 text-white rounded-lg px-5 py-2.5 text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              disabled={!canJoin}
            >
              Join
            </button>
          </div>

          <div className="flex items-center gap-3 text-neutral-500 text-xs my-1">
            <span className="flex-1 h-px bg-neutral-800" />
            or
            <span className="flex-1 h-px bg-neutral-800" />
          </div>

          <button
            type="button"
            className="w-full bg-transparent text-emerald-500 border border-emerald-500 rounded-lg px-5 py-2.5 text-[15px] font-semibold cursor-pointer hover:bg-emerald-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={createRoom}
            disabled={!canAct}
          >
            Create Room
          </button>
        </form>
      </div>
    </div>
  );
}
