import { redirect } from 'next/navigation';
import RoomClient from '@/components/RoomClient';
import { ROOM_CODE_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@/constants/meeting';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ username?: string }>;
}) {
  const { roomName } = await params;
  const { username } = await searchParams;
  const trimmedName = username?.trim() ?? '';

  // A valid display name and room code are required; send anything else back to the form.
  if (
    !trimmedName ||
    trimmedName.length > USERNAME_MAX_LENGTH ||
    decodeURIComponent(roomName).length > ROOM_CODE_MAX_LENGTH
  ) {
    redirect('/');
  }

  return <RoomClient roomName={roomName} username={trimmedName} />;
}
