import RoomClient from '@/components/RoomClient';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ username?: string }>;
}) {
  const { roomName } = await params;
  const { username = 'Guest' } = await searchParams;

  return <RoomClient roomName={roomName} username={username} />;
}
