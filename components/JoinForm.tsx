'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const inputClass =
  'w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 text-[15px] outline-none focus:border-primary-500 transition-colors placeholder:text-neutral-600';

type Mode = 'select' | 'create' | 'join';

export default function JoinForm() {
  const [mode, setMode] = useState<Mode>('select');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  function goBack() {
    setMode('select');
    setRoomCode('');
    setJoinError('');
  }

  function createRoom(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    const code = roomCode.trim() || generateRoomCode();
    router.push(
      `/room/${encodeURIComponent(code)}?username=${encodeURIComponent(username.trim())}`,
    );
  }

  async function joinRoom(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    const trimmedCode = roomCode.trim();
    if (!username.trim() || !trimmedCode) return;

    setJoinError('');
    setIsJoining(true);
    try {
      const res = await fetch(
        `/api/room-exists?room=${encodeURIComponent(trimmedCode)}`,
      );

      if (res.status >= 500) {
        setJoinError('Something went wrong on our end. Please try again.');
        return;
      }

      const data = (await res.json()) as { exists?: boolean };

      if (!res.ok || !data.exists) {
        setJoinError(
          `No meeting found with code "${trimmedCode}". Check the code and try again.`,
        );
        return;
      }

      router.push(
        `/room/${encodeURIComponent(trimmedCode)}?username=${encodeURIComponent(username.trim())}`,
      );
    } catch {
      setJoinError('Could not verify the room code. Please try again.');
    } finally {
      setIsJoining(false);
    }
  }

  const canCreate = username.trim().length > 0;
  const canJoin =
    username.trim().length > 0 && roomCode.trim().length > 0 && !isJoining;

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

          {mode !== 'select' && (
            <button
              type="button"
              onClick={goBack}
              className="text-neutral-600 hover:text-neutral-300 text-sm mb-4 transition-colors cursor-pointer"
            >
              ← Back
            </button>
          )}

          <h2 className="text-xl font-bold text-neutral-100 mb-1">
            {mode === 'select' && 'Get started'}
            {mode === 'create' && 'Create a meeting'}
            {mode === 'join' && 'Join a meeting'}
          </h2>
          <p className="text-neutral-600 text-sm mb-8">
            {mode === 'select' &&
              'Create a new meeting or join one with a room code.'}
            {mode === 'create' &&
              "Choose a room code, or leave it blank and we'll generate one."}
            {mode === 'join' &&
              'Enter the room code your host shared with you.'}
          </p>

          {mode === 'select' && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setMode('create')}
                className="w-full rounded-lg px-5 py-3 text-[15px] font-semibold transition-colors cursor-pointer"
                style={{ backgroundColor: '#DB4C77', color: '#FCEEF2' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#E88DA8')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = '#DB4C77')
                }
              >
                Create Meeting
              </button>

              <button
                type="button"
                onClick={() => setMode('join')}
                className="w-full rounded-lg px-5 py-3 text-[15px] font-semibold border transition-colors cursor-pointer"
                style={{ borderColor: '#DB4C77', color: '#F1B7C9' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    'rgba(219, 76, 119, 0.1)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                Join Meeting
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={createRoom} className="flex flex-col gap-3">
              <input
                className={inputClass}
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                autoComplete="off"
                autoFocus
              />

              <input
                className={inputClass}
                type="text"
                placeholder="Room code (optional)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={20}
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={!canCreate}
                className="w-full rounded-lg px-5 py-3 text-[15px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#DB4C77', color: '#FCEEF2' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#E88DA8')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = '#DB4C77')
                }
              >
                Create Meeting
              </button>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={joinRoom} className="flex flex-col gap-3">
              <input
                className={inputClass}
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                autoComplete="off"
                autoFocus
              />

              <input
                className={inputClass}
                type="text"
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                maxLength={20}
                autoComplete="off"
              />

              {joinError && (
                <p className="text-sm" style={{ color: '#F1B7C9' }}>
                  {joinError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canJoin}
                className="w-full rounded-lg px-5 py-3 text-[15px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#DB4C77', color: '#FCEEF2' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#E88DA8')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = '#DB4C77')
                }
              >
                {isJoining ? 'Checking...' : 'Join Meeting'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
