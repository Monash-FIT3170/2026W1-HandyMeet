import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RoomClient from '@/components/RoomClient';
import { ROOM_CODE_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@/constants/meeting';

export default async function RoomPage() {
  const jar = await cookies();
  const roomName = jar.get('room')?.value;
  const trimmedName = jar.get('username')?.value?.trim() ?? '';

  if (
    !roomName ||
    !trimmedName ||
    trimmedName.length > USERNAME_MAX_LENGTH ||
    roomName.length > ROOM_CODE_MAX_LENGTH
  ) {
    redirect('/');
  }

  return <RoomClient roomName={roomName} username={trimmedName} />;
}
