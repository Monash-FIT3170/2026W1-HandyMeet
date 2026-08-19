'use client';

import 'tldraw/tldraw.css';
import '@tldraw/commenting/commenting.css';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { ConnectionState, type Participant, RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  commentSchemaRecords,
  createTLSchema,
  createTLStore,
  defaultShapeUtils,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultStylePanel,
  squashRecordDiffs,
  Tldraw,
  TldrawUiMenuActionItem,
  TldrawUiMenuGroup,
  type Editor,
  type TLComponents,
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

const WHITEBOARD_TOPIC = 'handy-meet-whiteboard-v1';
const CHUNK_SIZE = 12_000;

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

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
}

/** A transient message shown in the whiteboard header. */
interface StatusMessage {
  tone: 'info' | 'error';
  text: string;
}

const STATUS_TIMEOUT_MS = 4000;

/** Action id for our added menu item. Namespaced to avoid tldraw collisions. */
const IMPORT_ACTION_ID = 'handymeet-import-svg';

/** Translation key backing {@link IMPORT_ACTION_ID}'s label. */
const IMPORT_LABEL_KEY = 'handymeet.import-svg';

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
  }, []);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      <div className="h-[45px] flex items-center justify-between px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <span
          role="status"
          className={`text-xs ${
            status?.tone === 'error' ? 'text-amber-400' : 'text-neutral-400'
          }`}
        >
          {status?.text ?? ''}
        </span>

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
            onMount={handleEditorMount}
            tools={tools}
            overrides={[commentToolOverrides, svgOverrides]}
            components={components}
            autoFocus
          />
        </div>
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
