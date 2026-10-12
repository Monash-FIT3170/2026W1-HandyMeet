import { redirect } from 'next/navigation';
import RoomClient from '@/components/RoomClient';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ username?: string }>;
}) {
  const { roomName } = await params;
  const { username } = await searchParams;

  // A display name is required to join; send nameless visitors back to the form.
  if (!username?.trim()) {
    redirect('/');
  }

  return <RoomClient roomName={roomName} username={username.trim()} />;
}
