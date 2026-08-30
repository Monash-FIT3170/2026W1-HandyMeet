import {
  AssetRecordType,
  getSnapshot,
  loadSnapshot,
  type Editor,
  type TLAsset,
  type TLAssetId,
  type TLBinding,
  type TLContent,
  type TLEditorSnapshot,
  type TLImageShape,
  type TLRecord,
  type TLShape,
} from 'tldraw';
import { embedSnapshotInSvg, extractSnapshotFromSvg } from './svgSnapshot';

/** Fallback canvas size used when an SVG declares no usable dimensions. */
const FALLBACK_IMAGE_SIZE = { width: 640, height: 480 } as const;

/** Result of an export attempt. */
export type ExportResult =
  | { status: 'success'; filename: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/**
 * How an import should treat whatever is already on the whiteboard.
 *
 * - `add` — keep the existing board and bring the imported content in
 *   alongside it. Never destroys anything.
 * - `replace` — clear the board first, so only the imported content remains.
 */
export type ImportMode = 'add' | 'replace';

/** Context handed to {@link ImportOptions.chooseMode} so it can prompt. */
export interface ImportModeRequest {
  /** Name of the file being imported. */
  filename: string;
  /** Whether the file carries a restorable HandyMeet snapshot. */
  hasSnapshot: boolean;
  /** How many shapes are currently on the page. Always greater than zero. */
  currentShapeCount: number;
}

/** Options for {@link importWhiteboardFromSvg}. */
export interface ImportOptions {
  /**
   * Asked how to handle an import when the board already has shapes on it.
   * Return `null` to cancel. When omitted, imports default to `add`, which is
   * the non-destructive choice.
   */
  chooseMode?: (
    request: ImportModeRequest,
  ) => Promise<ImportMode | null> | ImportMode | null;
}

/**
 * Result of an import attempt.
 *
 * - `restored` — the file carried a HandyMeet snapshot; shapes are editable.
 * - `placed` — a foreign SVG was added to the canvas as a single image.
 */
export type ImportResult =
  | { status: 'restored'; shapeCount: number; mode: ImportMode }
  | { status: 'placed'; mode: ImportMode }
  | { status: 'cancelled' }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

/** Builds a filesystem-friendly, sortable filename for an export. */
const buildFilename = (date: Date = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `handymeet-whiteboard-${stamp}.svg`;
};

/** Triggers a browser download for the given SVG markup. */
const downloadSvg = (svg: string, filename: string): void => {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Exports the current page as an SVG with the full whiteboard snapshot
 * embedded, then downloads it.
 *
 * The downloaded file opens as a normal image anywhere, but re-importing it
 * into HandyMeet restores every shape as editable.
 *
 * @param editor - The mounted tldraw editor.
 * @returns The outcome, including the filename on success.
 */
export const exportWhiteboardToSvg = async (
  editor: Editor,
): Promise<ExportResult> => {
  const shapeIds = [...editor.getCurrentPageShapeIds()];

  if (shapeIds.length === 0) {
    return { status: 'empty' };
  }

  try {
    // `padding` is deliberately left at the tldraw default: its type differs
    // between tldraw 3.x (number) and 5.x ('auto' | number).
    const exported = await editor.getSvgString(shapeIds, { background: true });

    if (!exported?.svg) {
      return { status: 'error', message: 'Could not render the whiteboard.' };
    }

    const svg = embedSnapshotInSvg(exported.svg, getSnapshot(editor.store));
    const filename = buildFilename();
    downloadSvg(svg, filename);

    return { status: 'success', filename };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Export failed.',
    };
  }
};

/**
 * Reads the intrinsic size of an SVG, preferring explicit pixel `width`/
 * `height` and falling back to the `viewBox`.
 *
 * @param svg - The raw SVG markup.
 */
const readSvgSize = (svg: string): { width: number; height: number } => {
  const readLength = (attribute: 'width' | 'height'): number | null => {
    const match = svg.match(
      new RegExp(`<svg\\b[^>]*?\\b${attribute}=["']([^"']+)["']`),
    );
    if (!match) return null;

    // Reject percentages and other relative units; px and bare numbers are ok.
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (/%$/.test(match[1].trim())) return null;

    return value;
  };

  const width = readLength('width');
  const height = readLength('height');
  if (width && height) return { width, height };

  const viewBox = svg.match(/<svg\b[^>]*?\bviewBox=["']([^"']+)["']/);
  if (viewBox) {
    const parts = viewBox[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return { ...FALLBACK_IMAGE_SIZE };
};

/** Encodes SVG markup as a UTF-8 safe data URI. */
const toSvgDataUri = (svg: string): string => {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
};

/** Removes every shape from the current page. */
const clearCurrentPage = (editor: Editor): void => {
  const ids = [...editor.getCurrentPageShapeIds()];
  if (ids.length > 0) editor.deleteShapes(ids);
};

/**
 * Places a foreign SVG on the canvas as a single image shape, scaled to fit
 * the viewport and centred in it.
 */
const placeSvgAsImage = (editor: Editor, svg: string, name: string): void => {
  const { width, height } = readSvgSize(svg);
  const viewport = editor.getViewportPageBounds();

  // Scale down to fit comfortably inside the viewport, never scale up.
  const scale = Math.min(
    1,
    (viewport.width * 0.8) / width,
    (viewport.height * 0.8) / height,
  );
  const shapeWidth = width * scale;
  const shapeHeight = height * scale;

  const assetId: TLAssetId = AssetRecordType.createId();

  editor.createAssets([
    {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      meta: {},
      props: {
        name,
        src: toSvgDataUri(svg),
        w: width,
        h: height,
        mimeType: 'image/svg+xml',
        isAnimated: false,
      },
    },
  ]);

  editor.createShape<TLImageShape>({
    type: 'image',
    x: viewport.center.x - shapeWidth / 2,
    y: viewport.center.y - shapeHeight / 2,
    props: { assetId, w: shapeWidth, h: shapeHeight },
  });
};

/**
 * Converts a snapshot into the `TLContent` shape that
 * {@link Editor.putContentOntoCurrentPage} understands, so imported shapes can
 * be merged into an existing board rather than replacing it.
 *
 * tldraw assigns fresh ids while placing the content, which keeps it from
 * colliding with shapes already on the board.
 *
 * @returns The content, or `null` if the snapshot holds no shapes.
 */
const buildContentFromSnapshot = (
  snapshot: TLEditorSnapshot,
): TLContent | null => {
  const store = snapshot.document?.store;
  if (!store) return null;

  const records = Object.values(store) as TLRecord[];
  const shapes = records.filter((r): r is TLShape => r.typeName === 'shape');
  if (shapes.length === 0) return null;

  return {
    shapes,
    bindings: records.filter((r): r is TLBinding => r.typeName === 'binding'),
    assets: records.filter((r): r is TLAsset => r.typeName === 'asset'),
    // Only page-level shapes are roots; children travel with their parents.
    rootShapeIds: shapes
      .filter((shape) => shape.parentId.startsWith('page:'))
      .map((shape) => shape.id),
    schema: snapshot.document.schema,
  };
};

/**
 * Imports an SVG file into the whiteboard.
 *
 * Files exported by HandyMeet come back as fully editable shapes; any other
 * SVG is brought in as a single image that can be drawn over. Either way the
 * caller decides, via {@link ImportOptions.chooseMode}, whether to add to the
 * current board or replace it.
 *
 * @param editor - The mounted tldraw editor.
 * @param file - The user-selected `.svg` file.
 * @param options - Hooks for choosing between adding and replacing.
 */
export const importWhiteboardFromSvg = async (
  editor: Editor,
  file: File,
  options: ImportOptions = {},
): Promise<ImportResult> => {
  try {
    const contents = await file.text();

    if (!contents.includes('<svg')) {
      return {
        status: 'invalid',
        message: `${file.name} doesn't look like an SVG file.`,
      };
    }

    const snapshot = extractSnapshotFromSvg(contents);
    const currentShapeCount = editor.getCurrentPageShapeIds().size;

    // Nothing on the board means nothing to protect, so skip the prompt.
    let mode: ImportMode = 'add';
    if (currentShapeCount > 0 && options.chooseMode) {
      const chosen = await options.chooseMode({
        filename: file.name,
        hasSnapshot: snapshot !== null,
        currentShapeCount,
      });
      if (!chosen) return { status: 'cancelled' };
      mode = chosen;
    }

    if (snapshot) {
      if (mode === 'replace') {
        loadSnapshot(editor.store, snapshot);
        return {
          status: 'restored',
          shapeCount: editor.getCurrentPageShapeIds().size,
          mode,
        };
      }

      const content = buildContentFromSnapshot(snapshot);
      if (!content) {
        return {
          status: 'invalid',
          message: `${file.name} has no shapes to import.`,
        };
      }

      editor.putContentOntoCurrentPage(content, { select: true });
      return { status: 'restored', shapeCount: content.shapes.length, mode };
    }

    if (mode === 'replace') clearCurrentPage(editor);
    placeSvgAsImage(editor, contents, file.name);
    return { status: 'placed', mode };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Import failed.',
    };
  }
};
