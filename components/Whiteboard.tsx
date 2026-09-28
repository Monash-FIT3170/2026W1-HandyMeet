'use client';

import 'tldraw/tldraw.css';
import '@tldraw/commenting/commenting.css';
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  ParticipantTile,
  ControlBar,
} from '@livekit/components-react';
import {
  ConnectionState,
  type Participant,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  commentSchemaRecords,
  createTLSchema,
  createTLStore,
  defaultShapeUtils,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultStylePanel,
  InstancePresenceRecordType,
  squashRecordDiffs,
  Tldraw,
  TldrawUiMenuActionItem,
  TldrawUiMenuGroup,
  type Editor,
  type TLComponents,
  type TLInstancePresence,
  type TLPageId,
  type TLStoreEventInfo,
  type TLUiOverrides,
} from 'tldraw';
import {
  CanvasComments,
  CommentAuthor,
  CommentTool,
  commentToolOverrides,
  filterMentionMembers,
  MentionMember,
} from '@tldraw/commenting';
import {
  exportWhiteboardToSvg,
  importWhiteboardFromSvg,
  type ImportMode,
  type ImportModeRequest,
} from '@/helpers/whiteboard/svgTransfer';
import TranscriptionSettings from '@/components/TranscriptionSettings';
import type { CaptionSettings } from '@/components/TranscriptionSettings';
import GestureDrawingOverlay from '@/components/GestureDrawingOverlay';
import {
  useGestureDrawing,
  type DrawingStroke,
} from '@/hooks/useGestureDrawing';
import { DrawingGesture } from '@/constants/gestures';
import { addStrokeToTldraw } from '@/helpers/gestures/strokeToTldraw';

const WHITEBOARD_TOPIC = 'handy-meet-whiteboard-v1';
const CURSOR_TOPIC = 'handy-meet-whiteboard-cursors-v1';
const CHUNK_SIZE = 12_000;
const CURSOR_FLUSH_MS = 33;

/**
 * How long to buffer store changes before broadcasting them, in milliseconds.
 * ~20 updates per second stays responsive without flooding the data channel.
 */
const DIFF_FLUSH_MS = 50;

type WhiteboardMessage =
  | { type: 'request' }
  | {
      type: 'snapshot';
      snapshot: ReturnType<
        ReturnType<typeof createTLStore>['getStoreSnapshot']
      >;
    }
  | { type: 'diff'; changes: TLStoreEventInfo['changes'] };

type CursorMessage = {
  cursor: Pick<NonNullable<TLInstancePresence['cursor']>, 'x' | 'y'> | null;
  currentPageId: TLPageId;
  userName: string;
  color: string;
  lastActivityTimestamp: number;
};

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  captionSettings: CaptionSettings;
  onCaptionSettingsChange: (s: CaptionSettings) => void;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

/** A transient message shown in the whiteboard header. */
interface StatusMessage {
  tone: 'info' | 'error';
  text: string;
}

function participantColor(identity: string) {
  let hash = 0;
  for (let i = 0; i < identity.length; i += 1) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 80%, 50%)`;
}

function tldrawUserId(identity: string) {
  const namespacedIdentity = identity.startsWith('user:')
    ? identity
    : `user:${identity}`;
  return namespacedIdentity as TLInstancePresence['userId'];
}

const STATUS_TIMEOUT_MS = 4000;

/** Action id for our added menu item. Namespaced to avoid tldraw collisions. */
const IMPORT_ACTION_ID = 'handymeet-import-svg';

/** Translation key backing {@link IMPORT_ACTION_ID}'s label. */
const IMPORT_LABEL_KEY = 'handymeet.import-svg';

export default function Whiteboard({
  isOpen,
  onClose,
  captionSettings,
  onCaptionSettingsChange,
  localVideoRef,
}: WhiteboardProps) {
  const room = useRoomContext();
  const { isCameraEnabled } = useLocalParticipant();
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

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  ).filter(
    (track) => !track.participant.identity.toLowerCase().startsWith('agent-'),
  );

  const [captionsOpen, setCaptionsOpen] = useState(false);

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

    // A freehand stroke updates its points on every pointer move, so sending a
    // message per store change floods the data channel and makes drawing feel
    // laggy for everyone. Buffer the diffs instead and flush a single squashed
    // diff on a short interval.
    let pending: TLStoreEventInfo['changes'][] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushDiffs = () => {
      flushTimer = null;
      if (pending.length === 0) return;
      const changes = squashRecordDiffs(pending);
      pending = [];
      safelySend({ type: 'diff', changes });
    };

    const stopListening = store.listen(
      ({ changes }) => {
        pending.push(changes);
        flushTimer ??= setTimeout(flushDiffs, DIFF_FLUSH_MS);
      },
      { source: 'user', scope: 'document' },
    );
    if (room.state === ConnectionState.Connected) requestSnapshot();

    return () => {
      stopListening();
      if (flushTimer) clearTimeout(flushTimer);
      // Don't leave the last stroke stranded on someone else's board.
      flushDiffs();
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

      return {
        id: p.identity,
        name: p.name || (isMe ? 'You' : p.identity),
        color: participantColor(p.identity),
        you: isMe,
      };
    });
  }, [participants, currentUserId]);
  const tldrawAuthors: Record<string, CommentAuthor> = useMemo(() => {
    return Object.fromEntries(tldrawMembers.map((m) => [m.id, m]));
  }, [tldrawMembers]);

  // `useParticipants` re-renders on ActiveSpeakersChanged and
  // ConnectionQualityChanged, which fire continuously during a live call. Both
  // values below are only ever read from callbacks, so holding them in refs
  // keeps the `components` object stable — otherwise tldraw is handed new
  // component identities and unmounts its menus, style panel and comment
  // overlay every time someone starts or stops talking.
  const tldrawMembersRef = useRef(tldrawMembers);
  const tldrawAuthorsRef = useRef(tldrawAuthors);

  useEffect(() => {
    tldrawMembersRef.current = tldrawMembers;
    tldrawAuthorsRef.current = tldrawAuthors;
  }, [tldrawMembers, tldrawAuthors]);

  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  // The import prompt is a promise the dialog resolves, so the import helper
  // can simply await the user's choice.
  const [modeRequest, setModeRequest] = useState<ImportModeRequest | null>(
    null,
  );
  const modeResolverRef = useRef<((mode: ImportMode | null) => void) | null>(
    null,
  );

  const chooseImportMode = useCallback(
    (request: ImportModeRequest) =>
      new Promise<ImportMode | null>((resolve) => {
        modeResolverRef.current = resolve;
        setModeRequest(request);
      }),
    [],
  );

  const resolveImportMode = useCallback((mode: ImportMode | null) => {
    setModeRequest(null);
    modeResolverRef.current?.(mode);
    modeResolverRef.current = null;
  }, []);

  const showStatus = useCallback((message: StatusMessage) => {
    setStatus(message);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(
      () => setStatus(null),
      STATUS_TIMEOUT_MS,
    );
  }, []);

  const handleEditorMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    setEditor(editor);
  }, []);

  useEffect(() => {
    if (!isOpen || !editor) return;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const localParticipant = room.localParticipant;
    const identity = localParticipant.identity;
    const userName = localParticipant.name || identity;
    const color = participantColor(identity);
    let lastSentAt = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const publishCursor = (cursor: CursorMessage['cursor']) => {
      const message: CursorMessage = {
        cursor,
        currentPageId: editor.getCurrentPageId(),
        userName,
        color,
        lastActivityTimestamp: Date.now(),
      };

      void localParticipant
        .publishData(encoder.encode(JSON.stringify(message)), {
          reliable: false,
          topic: CURSOR_TOPIC,
        })
        .catch((error) => {
          console.error('Failed to send whiteboard cursor:', error);
        });
    };

    const sendCurrentCursor = () => {
      pendingTimer = null;
      lastSentAt = Date.now();
      const point = editor.inputs.currentPagePoint;
      publishCursor({ x: point.x, y: point.y });
    };

    const handleEditorEvent = (event: { type: string; name: string }) => {
      if (event.type !== 'pointer' || event.name !== 'pointer_move') return;

      const remaining = CURSOR_FLUSH_MS - (Date.now() - lastSentAt);
      if (remaining <= 0) {
        if (pendingTimer) clearTimeout(pendingTimer);
        sendCurrentCursor();
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(sendCurrentCursor, remaining);
      }
    };

    const handleCursorData = (
      payload: Uint8Array,
      sender?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== CURSOR_TOPIC || !sender || sender.identity === identity) {
        return;
      }

      try {
        const message = JSON.parse(decoder.decode(payload)) as CursorMessage;
        // The commenting schema validates tldraw user IDs using the `user:`
        // namespace, while LiveKit identities arrive as plain strings.
        const userId = tldrawUserId(sender.identity);
        const presence = InstancePresenceRecordType.create({
          id: InstancePresenceRecordType.createId(sender.identity),
          userId,
          userName: message.userName || sender.name || sender.identity,
          color: message.color || participantColor(sender.identity),
          // Each client creates its initial tldraw page locally. When two new
          // clients exchange snapshots at the same time, those internal page
          // IDs can differ even though both are viewing the shared board.
          // Presence is local-only, so anchor it to this editor's active page.
          currentPageId: editor.getCurrentPageId(),
          cursor: message.cursor
            ? { ...message.cursor, type: 'default', rotation: 0 }
            : null,
          lastActivityTimestamp: message.lastActivityTimestamp,
        });
        store.mergeRemoteChanges(() => store.put([presence]));
      } catch (error) {
        console.error('Failed to receive whiteboard cursor:', error);
      }
    };

    const removeParticipantCursor = (participant: Participant) => {
      const presenceId = InstancePresenceRecordType.createId(
        participant.identity,
      );
      store.mergeRemoteChanges(() => store.remove([presenceId]));
    };

    editor.on('event', handleEditorEvent);
    room.on(RoomEvent.DataReceived, handleCursorData);
    room.on(RoomEvent.ParticipantDisconnected, removeParticipantCursor);
    sendCurrentCursor();

    return () => {
      editor.off('event', handleEditorEvent);
      room.off(RoomEvent.DataReceived, handleCursorData);
      room.off(RoomEvent.ParticipantDisconnected, removeParticipantCursor);
      if (pendingTimer) clearTimeout(pendingTimer);
      publishCursor(null);
      const presenceIds = store
        .allRecords()
        .filter((record) => record.typeName === 'instance_presence')
        .map((record) => record.id);
      store.mergeRemoteChanges(() => store.remove(presenceIds));
    };
  }, [editor, isOpen, room, store]);

  // `CommentTool.configure()` returns a fresh class on every call, and tldraw
  // recreates the entire Editor whenever the contents of `tools` change
  // identity — disposing it mid-stroke and resetting the selected tool. Build
  // the array once so the editor survives re-renders.
  const tools = useMemo(
    () => [CommentTool.configure({ enableRegions: true })],
    [],
  );

  /** Runs our snapshot-embedding export and reports the outcome. */
  const runExport = useCallback(
    async (editor: Editor) => {
      const result = await exportWhiteboardToSvg(editor);

      if (result.status === 'success') {
        showStatus({ tone: 'info', text: `Exported ${result.filename}` });
      } else if (result.status === 'empty') {
        showStatus({
          tone: 'error',
          text: 'Nothing to export — the whiteboard is empty.',
        });
      } else {
        showStatus({ tone: 'error', text: result.message });
      }
    },
    [showStatus],
  );

  const svgOverrides = useMemo<TLUiOverrides>(
    () => ({
      actions(editor, actions) {
        const next = { ...actions };

        // The burger menu's "Export as > SVG" always exports the whole page,
        // which is exactly what a snapshot represents — so replace it wholesale
        // and users get a re-importable file from the menu they already use.
        if (next['export-all-as-svg']) {
          next['export-all-as-svg'] = {
            ...next['export-all-as-svg'],
            onSelect: () => runExport(editor),
          };
        }

        // The Edit/context-menu "Export as > SVG" exports the selection when
        // there is one. A partial export can't honestly carry a whole-board
        // snapshot, so only take it over when nothing is selected.
        const exportSelection = actions['export-as-svg'];
        if (exportSelection) {
          next['export-as-svg'] = {
            ...exportSelection,
            onSelect: (source) =>
              editor.getSelectedShapeIds().length > 0
                ? exportSelection.onSelect(source)
                : runExport(editor),
          };
        }

        next[IMPORT_ACTION_ID] = {
          id: IMPORT_ACTION_ID,
          label: IMPORT_LABEL_KEY,
          readonlyOk: false,
          onSelect: () => {
            fileInputRef.current?.click();
          },
        };

        return next;
      },
      translations: {
        en: { [IMPORT_LABEL_KEY]: 'Import SVG…' },
      },
    }),
    [runExport],
  );

  const components = useMemo<TLComponents>(
    () => ({
      InFrontOfTheCanvas: () => (
        <CanvasComments
          currentUserId={currentUserId}
          resolveAuthor={(id: string) =>
            tldrawAuthorsRef.current[id] ?? { name: id }
          }
          getMentionSuggestions={(query) =>
            filterMentionMembers(tldrawMembersRef.current, query)
          }
        />
      ),
      StylePanel: () => (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          <DefaultStylePanel />
        </div>
      ),
      MainMenu: () => (
        <DefaultMainMenu>
          <TldrawUiMenuGroup id="handymeet-whiteboard-io">
            <TldrawUiMenuActionItem actionId={IMPORT_ACTION_ID} />
          </TldrawUiMenuGroup>
          <DefaultMainMenuContent />
        </DefaultMainMenu>
      ),
    }),
    [currentUserId],
  );

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset immediately so re-picking the same file fires another change.
      event.target.value = '';

      const editor = editorRef.current;
      if (!file || !editor) return;

      const result = await importWhiteboardFromSvg(editor, file, {
        chooseMode: chooseImportMode,
      });

      switch (result.status) {
        case 'restored': {
          const shapes = `${result.shapeCount} ${
            result.shapeCount === 1 ? 'shape' : 'shapes'
          }`;
          showStatus({
            tone: 'info',
            text:
              result.mode === 'add'
                ? `Added ${shapes} — ready to edit`
                : `Restored ${shapes} — ready to edit`,
          });
          break;
        }
        case 'placed':
          showStatus({
            tone: 'info',
            text:
              result.mode === 'add'
                ? 'Added as an image — draw on top of it'
                : 'Replaced the board with the imported image',
          });
          break;
        case 'cancelled':
          break;
        default:
          showStatus({ tone: 'error', text: result.message });
      }
    },
    [chooseImportMode, showStatus],
  );

  // --- Gesture drawing ---

  const [gestureDrawingEnabled, setGestureDrawingEnabled] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = canvasContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  const handleStrokeComplete = useCallback(
    (stroke: DrawingStroke) => {
      if (editorRef.current && stroke.length >= 2) {
        addStrokeToTldraw(
          editorRef.current,
          stroke,
          canvasSize.width,
          canvasSize.height,
        );
      }
      setCurrentStroke([]);
    },
    [canvasSize.width, canvasSize.height],
  );

  const handleStrokeUpdate = useCallback((stroke: DrawingStroke) => {
    setCurrentStroke(stroke);
  }, []);

  const { isDrawing, cursorPosition, currentGesture } = useGestureDrawing({
    videoRef: localVideoRef,
    enabled: isOpen && gestureDrawingEnabled && isCameraEnabled,
    onStrokeComplete: handleStrokeComplete,
    onStrokeUpdate: handleStrokeUpdate,
  });

  const handleToggleGestureDrawing = useCallback(() => {
    setGestureDrawingEnabled((prev) => !prev);
    setCurrentStroke([]);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      {/* Header panel */}
      <div className="h-[45px] flex items-center justify-between px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleGestureDrawing}
            className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
              gestureDrawingEnabled
                ? isCameraEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
            {gestureDrawingEnabled ? 'Gesture Draw: ON' : 'Gesture Draw'}
          </button>

          {gestureDrawingEnabled && isCameraEnabled && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              {currentGesture === DrawingGesture.Pointing && (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  Drawing...
                </span>
              )}
              {currentGesture === DrawingGesture.Fist && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  Saved to canvas
                </span>
              )}
              {!currentGesture && cursorPosition && (
                <span className="text-neutral-500">Point finger to draw</span>
              )}
            </div>
          )}

          <span
            role="status"
            className={`text-xs ${
              status?.tone === 'error' ? 'text-amber-400' : 'text-neutral-400'
            }`}
          >
            {status?.text ?? ''}
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="relative flex-1 flex flex-row overflow-hidden">
        {/* Whiteboard */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            position: 'relative',
          }}
        >
          <Tldraw
            licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
            store={store}
            onMount={handleEditorMount}
            tools={tools}
            overrides={[commentToolOverrides, svgOverrides]}
            components={components}
            autoFocus
          />

          {gestureDrawingEnabled && isCameraEnabled && (
            <GestureDrawingOverlay
              cursorPosition={cursorPosition}
              strokes={currentStroke.length > 0 ? [currentStroke] : []}
              isDrawing={isDrawing}
              currentGesture={currentGesture}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          )}

          {gestureDrawingEnabled && !isCameraEnabled && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-black flex items-center gap-3 shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.5 22H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" />
                <circle cx="12" cy="11" r="3" />
                <path d="m17 17 5 5m-5 0 5-5" />
              </svg>
              <span className="font-medium">
                Camera is off — turn on your camera to use gesture drawing
              </span>
            </div>
          )}

          {gestureDrawingEnabled && isCameraEnabled && (
            <div className="absolute bottom-4 left-4 bg-neutral-900/90 backdrop-blur-sm rounded-lg p-3 text-xs text-neutral-300 max-w-[200px] border border-neutral-700">
              <p className="font-semibold mb-2 text-white">Gesture Controls</p>
              <div className="space-y-1">
                <p className="flex items-center gap-2">
                  <span className="text-blue-400">Point finger</span>
                  <span className="text-neutral-500">= Draw</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-green-400">Make fist</span>
                  <span className="text-neutral-500">= Save stroke</span>
                </p>
              </div>
              <p className="mt-2 text-neutral-500 text-[10px]">
                Using meeting camera for tracking
              </p>
            </div>
          )}
        </div>

        {/* Video Side Bar */}
        <div
          style={{
            width: '320px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(10, 10, 18, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <h3
            style={{
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.8,
            }}
          >
            Participants ({tracks.length})
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {tracks.map((track) => (
              <div
                key={`${track.participant.identity}-${track.source}`}
                style={{
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  position: 'relative',
                }}
              >
                <ParticipantTile trackRef={track} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Control bar footer */}
      <div className="h-[64px] w-full flex items-center px-4 bg-neutral-900 border-t border-neutral-800 shrink-0 select-none text-neutral-300">
        {/*  Control bar  */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0.5rem 5rem 0.75rem 1.75rem',
            position: 'relative',
            height: '100%',
            width: '100%',
          }}
        >
          {/* Gradient accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background:
                'linear-gradient(90deg, transparent 0%, #10599A 20%, #7099C2 50%, #DB4C77 80%, transparent 100%)',
              opacity: 0.9,
            }}
          />

          {/* Centre pill */}
          <div className="flex-initial flex items-center justify-end lk-video-conference">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                borderRadius: '999px',
                padding: '0.3rem 0.5rem',
                zIndex: 999,
              }}
            >
              <ControlBar
                controls={{
                  microphone: true,
                  camera: true,
                  screenShare: false,
                  chat: false,
                  settings: false,
                  leave: false,
                }}
                style={{
                  border: 'none',
                  padding: 0,
                  gap: '0.25rem',
                  display: 'contents',
                  alignItems: 'center',
                }}
              />

              {/* Divider */}
              <div
                style={{
                  width: '1px',
                  height: '1.5rem',
                  background: 'rgba(255,255,255,0.00)',
                  margin: '0 5rem',
                  flexShrink: 0,
                }}
              />

              {/* Captions */}
              <div style={{ position: 'relative' }}>
                {captionsOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 0.75rem)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 9999,
                    }}
                  >
                    <TranscriptionSettings
                      settings={captionSettings}
                      onChange={onCaptionSettingsChange}
                      open={captionsOpen}
                      onClose={() => setCaptionsOpen(false)}
                    />
                  </div>
                )}
                <button
                  className="lk-button"
                  aria-pressed={captionsOpen}
                  onClick={() => setCaptionsOpen((v) => !v)}
                  title="Captions"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M8 10.5h4" />
                    <path d="M14 10.5h4" />
                    <path d="M8 14.5h4" />
                    <path d="M14 14.5h2" />
                  </svg>
                  Captions
                </button>
              </div>
            </div>
          </div>
        </div>
        {/*  End control bar  */}
      </div>

      {modeRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-mode-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') resolveImportMode(null);
          }}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="w-[min(28rem,90vw)] rounded-lg border border-neutral-700 bg-neutral-900 p-5 shadow-xl">
            <h2
              id="import-mode-title"
              className="text-sm font-semibold text-white break-all"
            >
              Import {modeRequest.filename}
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              {modeRequest.hasSnapshot
                ? 'This is a HandyMeet whiteboard, so it can come back as editable shapes.'
                : 'This SVG will come in as a single image you can draw over.'}{' '}
              There{' '}
              {modeRequest.currentShapeCount === 1
                ? 'is 1 shape'
                : `are ${modeRequest.currentShapeCount} shapes`}{' '}
              on the board already, and either choice applies to everyone in the
              meeting.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                autoFocus
                onClick={() => resolveImportMode('add')}
                className="text-xs px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer text-left"
              >
                Add to the current whiteboard
                <span className="block text-[11px] text-blue-100/80">
                  Keeps everything that&apos;s already there
                </span>
              </button>

              <button
                onClick={() => resolveImportMode('replace')}
                className="text-xs px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md transition-colors cursor-pointer text-left"
              >
                Replace everything on the whiteboard
                <span className="block text-[11px] text-neutral-400">
                  Clears the board first — this can&apos;t be undone by others
                </span>
              </button>

              <button
                onClick={() => resolveImportMode(null)}
                className="text-xs px-3 py-2 text-neutral-400 hover:text-neutral-200 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
