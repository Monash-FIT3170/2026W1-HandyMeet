import type { TLEditorSnapshot } from 'tldraw';

/**
 * The `id` of the `<metadata>` element used to carry a whiteboard snapshot
 * inside an exported SVG. Viewers and editors ignore unknown metadata, so an
 * SVG carrying this payload still renders as an ordinary image everywhere.
 */
export const SNAPSHOT_METADATA_ID = 'handymeet-whiteboard-snapshot';

/**
 * Bumped whenever the envelope format changes in a way older readers cannot
 * understand. The tldraw snapshot itself is versioned independently by tldraw.
 */
export const SNAPSHOT_FORMAT_VERSION = 1;

const APP_MARKER = 'handymeet';

/**
 * The envelope written into the SVG. Wrapping the raw tldraw snapshot lets us
 * detect our own files and reject unrelated payloads before handing anything
 * to tldraw.
 */
interface SnapshotEnvelope {
  app: typeof APP_MARKER;
  version: number;
  createdAt: string;
  snapshot: TLEditorSnapshot;
}

/**
 * Encodes a UTF-8 string as base64. Base64 contains no XML-significant
 * characters, so the result can be dropped straight into an SVG element
 * without escaping, and cannot break the surrounding document.
 */
const toBase64 = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

/** Reverses {@link toBase64}. */
const fromBase64 = (encoded: string): string => {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Finds the index just past the opening `<svg ...>` tag, quote-aware so that a
 * `>` inside an attribute value does not terminate the search early.
 *
 * @returns The insertion index, or `-1` if no opening tag was found.
 */
const findEndOfOpeningSvgTag = (svg: string): number => {
  const start = svg.indexOf('<svg');
  if (start === -1) return -1;

  let quote: '"' | "'" | null = null;

  for (let index = start; index < svg.length; index += 1) {
    const character = svg[index];

    if (quote) {
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '>') return index + 1;
  }

  return -1;
};

/**
 * Embeds a tldraw snapshot into an SVG string as base64 inside a `<metadata>`
 * element, so the file can later be re-imported as fully editable shapes.
 *
 * The SVG's visual output is unchanged.
 *
 * @param svg - The SVG markup produced by `editor.getSvgString`.
 * @param snapshot - The snapshot from `getSnapshot(editor.store)`.
 * @returns The SVG markup with the snapshot embedded.
 * @throws If `svg` does not contain a parseable opening `<svg>` tag.
 */
export const embedSnapshotInSvg = (
  svg: string,
  snapshot: TLEditorSnapshot,
): string => {
  const insertAt = findEndOfOpeningSvgTag(svg);
  if (insertAt === -1) {
    throw new Error('Could not find an opening <svg> tag to embed into.');
  }

  const envelope: SnapshotEnvelope = {
    app: APP_MARKER,
    version: SNAPSHOT_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    snapshot,
  };

  const payload = toBase64(JSON.stringify(envelope));
  const metadata =
    `<metadata id="${SNAPSHOT_METADATA_ID}"` +
    ` data-version="${SNAPSHOT_FORMAT_VERSION}">${payload}</metadata>`;

  return svg.slice(0, insertAt) + metadata + svg.slice(insertAt);
};

/**
 * Matches our metadata element. The payload is base64, so `[A-Za-z0-9+/=\s]*`
 * cannot run past the closing tag.
 */
const METADATA_PATTERN = new RegExp(
  `<metadata\\b[^>]*id=["']${SNAPSHOT_METADATA_ID}["'][^>]*>` +
    `([A-Za-z0-9+/=\\s]*)</metadata>`,
);

/**
 * Reads a tldraw snapshot back out of an SVG previously written by
 * {@link embedSnapshotInSvg}.
 *
 * This never throws: any SVG without a valid HandyMeet payload — a Figma
 * export, a hand-written icon, a truncated file — yields `null` so the caller
 * can fall back to placing the SVG as an image.
 *
 * @param svg - The raw contents of an SVG file.
 * @returns The embedded snapshot, or `null` if there isn't a usable one.
 */
export const extractSnapshotFromSvg = (
  svg: string,
): TLEditorSnapshot | null => {
  const match = svg.match(METADATA_PATTERN);
  if (!match) return null;

  const payload = match[1].replace(/\s+/g, '');
  if (!payload) return null;

  try {
    const envelope: unknown = JSON.parse(fromBase64(payload));

    if (typeof envelope !== 'object' || envelope === null) return null;

    const { app, version, snapshot } = envelope as Partial<SnapshotEnvelope>;

    if (app !== APP_MARKER) return null;
    if (typeof version !== 'number' || version > SNAPSHOT_FORMAT_VERSION) {
      return null;
    }
    if (typeof snapshot !== 'object' || snapshot === null) return null;

    return snapshot;
  } catch {
    return null;
  }
};

/**
 * Whether an SVG carries a restorable HandyMeet whiteboard snapshot.
 *
 * @param svg - The raw contents of an SVG file.
 */
export const hasEmbeddedSnapshot = (svg: string): boolean =>
  extractSnapshotFromSvg(svg) !== null;
