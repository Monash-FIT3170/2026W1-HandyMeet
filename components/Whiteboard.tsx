'use client';

import 'tldraw/tldraw.css';
import '@tldraw/commenting/commenting.css';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { ConnectionState, type Participant, RoomEvent } from 'livekit-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  commentSchemaRecords,
  createTLSchema,
  createTLStore,
  defaultShapeUtils,
  DefaultStylePanel,
  Tldraw,
  type TLStoreEventInfo,
} from 'tldraw';
import {
  CanvasComments,
  CommentAuthor,
  CommentTool,
  commentToolOverrides,
  filterMentionMembers,
  MentionMember,
} from '@tldraw/commenting';

const WHITEBOARD_TOPIC = 'handy-meet-whiteboard-v1';
const CHUNK_SIZE = 12_000;

type WhiteboardMessage =
  | { type: 'request' }
  | {
      type: 'snapshot';
      snapshot: ReturnType<
        ReturnType<typeof createTLStore>['getStoreSnapshot']
      >;
    }
  | { type: 'diff'; changes: TLStoreEventInfo['changes'] };

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Whiteboard({ isOpen, onClose }: WhiteboardProps) {
  const room = useRoomContext();
  const [store] = useState(() =>
    createTLStore({
      schema: createTLSchema({ records: commentSchemaRecords }),
      shapeUtils: [...defaultShapeUtils],
    }),
  );
  const chunks = useRef(
    new Map<string, { parts: Uint8Array[]; received: number }>(),
  );
  const hasLoadedSnapshot = useRef(false);

  useEffect(() => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const chunkMap = chunks.current;

    const send = async (
      message: WhiteboardMessage,
      destinationIdentity?: string,
    ) => {
      const body = encoder.encode(JSON.stringify(message));
      const id = `${room.localParticipant.identity}-${Date.now()}-${Math.random()}`;
      const total = Math.ceil(body.length / CHUNK_SIZE);

      for (let index = 0; index < total; index += 1) {
        const header = encoder.encode(`${id}|${index}|${total}\n`);
        const part = body.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
        const payload = new Uint8Array(header.length + part.length);
        payload.set(header);
        payload.set(part, header.length);
        await room.localParticipant.publishData(payload, {
          reliable: true,
          topic: WHITEBOARD_TOPIC,
          destinationIdentities: destinationIdentity
            ? [destinationIdentity]
            : undefined,
        });
      }
    };

    const safelySend = (
      message: WhiteboardMessage,
      destinationIdentity?: string,
    ) => {
      void send(message, destinationIdentity).catch((error) => {
        console.error('Failed to send whiteboard data:', error);
      });
    };

    const applyMessage = (message: WhiteboardMessage, sender?: Participant) => {
      if (message.type === 'request') {
        if (sender) {
          safelySend(
            {
              type: 'snapshot',
              snapshot: store.getStoreSnapshot(),
            },
            sender.identity,
          );
        }
        return;
      }

      if (message.type === 'snapshot') {
        if (hasLoadedSnapshot.current) return;
        hasLoadedSnapshot.current = true;
        store.mergeRemoteChanges(() =>
          store.loadStoreSnapshot(message.snapshot),
        );
        return;
      }

      store.mergeRemoteChanges(() => store.applyDiff(message.changes));
    };

    const handleData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== WHITEBOARD_TOPIC) return;

      try {
        const newline = payload.indexOf(10);
        if (newline < 0) return;
        const [id, indexText, totalText] = decoder
          .decode(payload.slice(0, newline))
          .split('|');
        const index = Number(indexText);
        const total = Number(totalText);
        if (!id || !Number.isInteger(index) || !Number.isInteger(total)) return;

        const entry = chunkMap.get(id) ?? {
          parts: Array<Uint8Array>(total),
          received: 0,
        };
        if (!entry.parts[index]) {
          entry.parts[index] = payload.slice(newline + 1);
          entry.received += 1;
        }
        chunkMap.set(id, entry);
        if (entry.received !== total) return;

        chunkMap.delete(id);
        const length = entry.parts.reduce((sum, part) => sum + part.length, 0);
        const complete = new Uint8Array(length);
        let offset = 0;
        for (const part of entry.parts) {
          complete.set(part, offset);
          offset += part.length;
        }
        applyMessage(
          JSON.parse(decoder.decode(complete)) as WhiteboardMessage,
          sender,
        );
      } catch (error) {
        console.error('Failed to sync whiteboard data:', error);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    const requestSnapshot = () => safelySend({ type: 'request' });
    room.on(RoomEvent.Connected, requestSnapshot);
    const stopListening = store.listen(
      ({ changes }) => safelySend({ type: 'diff', changes }),
      { source: 'user', scope: 'document' },
    );
    if (room.state === ConnectionState.Connected) requestSnapshot();

    return () => {
      stopListening();
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.Connected, requestSnapshot);
      chunkMap.clear();
    };
  }, [room, store]);

  const participants = useParticipants();
  const currentUserId = room.localParticipant?.identity;
  const tldrawMembers: MentionMember[] = useMemo(() => {
    return participants.map((p) => {
      const isMe = p.identity === currentUserId;

      let hash = 0;
      for (let i = 0; i < p.identity.length; i++) {
        hash = p.identity.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      const color = `hsl(${hue}, 80%, 50%)`;

      return {
        id: p.identity,
        name: p.name || (isMe ? 'You' : p.identity),
        color,
        you: isMe,
      };
    });
  }, [participants, currentUserId]);
  const tldrawAuthors: Record<string, CommentAuthor> = useMemo(() => {
    return Object.fromEntries(tldrawMembers.map((m) => [m.id, m]));
  }, [tldrawMembers]);
  const resolveTldrawAuthor = (id: string): CommentAuthor =>
    tldrawAuthors[id] ?? { name: id };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      <div className="h-[45px] flex items-center justify-end px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      <div className="relative flex-1 w-full overflow-hidden">
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          <Tldraw
            licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
            store={store}
            tools={[CommentTool.configure({ enableRegions: true })]}
            overrides={[commentToolOverrides]}
            components={{
              InFrontOfTheCanvas: () => (
                <CanvasComments
                  currentUserId={currentUserId}
                  resolveAuthor={resolveTldrawAuthor}
                  getMentionSuggestions={(query) =>
                    filterMentionMembers(tldrawMembers, query)
                  }
                />
              ),
              StylePanel: () => (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: 4,
                  }}
                >
                  <DefaultStylePanel />
                </div>
              ),
            }}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
