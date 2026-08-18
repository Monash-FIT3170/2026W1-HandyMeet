'use client';

import 'tldraw/tldraw.css';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionState, RoomEvent, type Participant } from 'livekit-client';
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createTLStore,
  DefaultStylePanel,
  defaultShapeUtils,
  Tldraw,
  useEditor,
  useValue,
  type Editor,
  type TLStoreEventInfo,
  type TLShape,
} from 'tldraw';

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
  username: string;
}

// Runs inside tldraw context — reads hovered shape and pushes author name outside
function HoverWatcher({
  setHoveredAuthor,
}: {
  setHoveredAuthor: Dispatch<SetStateAction<string | null>>;
}) {
  const editor = useEditor();

  const hoveredShapeId = useValue(
    'hoveredShapeId',
    () => editor.getHoveredShapeId(),
    [editor],
  );

  const hoveredShape = useValue(
    'hoveredShape',
    () => (hoveredShapeId ? editor.getShape(hoveredShapeId) : null),
    [editor, hoveredShapeId],
  );

  useEffect(() => {
    const author =
      hoveredShape && typeof hoveredShape.meta?.author === 'string'
        ? hoveredShape.meta.author
        : null;
    setHoveredAuthor(author);
  }, [hoveredShape, setHoveredAuthor]);

  return null;
}

// Runs inside tldraw context — stamps author on locally created shapes
function AuthorStamper({
  username,
  editorRef,
}: {
  username: string;
  editorRef: MutableRefObject<Editor | null>;
}) {
  const editor = useEditor();

  useEffect(() => {
    editorRef.current = editor;
    const cleanup = editor.sideEffects.registerBeforeCreateHandler(
      'shape',
      (shape: TLShape) => {
        return {
          ...shape,
          meta: { ...shape.meta, author: username },
        };
      },
    );
    return cleanup;
  }, [editor, username, editorRef]);

  return null;
}

export default function Whiteboard({
  isOpen,
  onClose,
  username,
}: WhiteboardProps) {
  const room = useRoomContext();
  const [store] = useState(() =>
    createTLStore({ shapeUtils: [...defaultShapeUtils] }),
  );
  const chunks = useRef(
    new Map<string, { parts: Uint8Array[]; received: number }>(),
  );
  const hasLoadedSnapshot = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  // Tooltip state — lives outside tldraw so fixed positioning works correctly
  const [hoveredAuthor, setHoveredAuthor] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

      if (message.type === 'diff') {
        if (sender) {
          const authorName = sender.name ?? sender.identity;
          const originalAdded = message.changes.added;
          if (originalAdded) {
            const stampedAdded = Object.fromEntries(
              Object.entries(originalAdded).map(([id, record]) => {
                if (record.typeName === 'shape') {
                  return [
                    id,
                    {
                      ...(record as TLShape),
                      meta: {
                        ...(record as TLShape).meta,
                        author: authorName,
                      },
                    },
                  ];
                }
                return [id, record];
              }),
            ) as typeof originalAdded;
            store.mergeRemoteChanges(() =>
              store.applyDiff({
                ...message.changes,
                added: stampedAdded,
              }),
            );
          } else {
            store.mergeRemoteChanges(() => store.applyDiff(message.changes));
          }
        } else {
          store.mergeRemoteChanges(() => store.applyDiff(message.changes));
        }
        return;
      }
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
        const length = entry.parts.reduce(
          (sum: number, part: Uint8Array) => sum + part.length,
          0,
        );
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
      ({ changes }: { changes: TLStoreEventInfo['changes'] }) =>
        safelySend({ type: 'diff', changes }),
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
            store={store}
            components={{
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
              OnTheCanvas: () => (
                <>
                  <AuthorStamper username={username} editorRef={editorRef} />
                  <HoverWatcher setHoveredAuthor={setHoveredAuthor} />
                </>
              ),
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Tooltip rendered via portal directly into document.body so fixed
          positioning isn't broken by tldraw's CSS transforms */}
      {hoveredAuthor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: mousePos.x + 14,
              top: mousePos.y - 36,
              background: 'rgba(20, 20, 20, 0.95)',
              color: '#fff',
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'sans-serif',
              pointerEvents: 'none',
              zIndex: 99999,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            ✏️ {hoveredAuthor}
          </div>,
          document.body,
        )}
    </div>
  );
}
