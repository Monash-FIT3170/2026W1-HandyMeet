import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RoomClient from '@/components/RoomClient';

export default async function RoomPage() {
  const jar = await cookies();
  const roomName = jar.get('room')?.value;
  const username = jar.get('username')?.value ?? 'Guest';

  if (!roomName) {
    redirect('/');
  }

  return <RoomClient roomName={roomName} username={username} />;
}
