/** @jest-environment jsdom */

import type { TLEditorSnapshot } from 'tldraw';
import {
  embedSnapshotInSvg,
  extractSnapshotFromSvg,
  hasEmbeddedSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  SNAPSHOT_METADATA_ID,
} from './svgSnapshot';

describe('svgSnapshot helpers', () => {
  const snapshot = {
    document: {
      schema: {
        schemaVersion: 2,
        sequences: {},
      },
      store: {},
    },
    session: {},
  } as unknown as TLEditorSnapshot;

  test('embeds metadata right after opening svg tag and can extract it back', () => {
    const source = '<svg width="200" height="100"><rect /></svg>';

    const embedded = embedSnapshotInSvg(source, snapshot);

    expect(embedded).toContain(`id="${SNAPSHOT_METADATA_ID}"`);
    expect(embedded).toContain(`data-version="${SNAPSHOT_FORMAT_VERSION}"`);
    expect(embedded.indexOf('</metadata>')).toBeGreaterThan(
      embedded.indexOf('>'),
    );
    expect(extractSnapshotFromSvg(embedded)).toEqual(snapshot);
    expect(hasEmbeddedSnapshot(embedded)).toBe(true);
  });

  test('handles > inside quoted attributes while finding svg opening tag', () => {
    const source =
      '<svg aria-label="x > y" width="200" height="100"><g /></svg>';

    const embedded = embedSnapshotInSvg(source, snapshot);

    expect(extractSnapshotFromSvg(embedded)).toEqual(snapshot);
  });

  test('throws if no opening svg tag exists', () => {
    expect(() => embedSnapshotInSvg('<div>not svg</div>', snapshot)).toThrow(
      'Could not find an opening <svg> tag to embed into.',
    );
  });

  test('returns null when no metadata payload exists', () => {
    const source = '<svg><circle cx="1" cy="1" r="1" /></svg>';

    expect(extractSnapshotFromSvg(source)).toBeNull();
    expect(hasEmbeddedSnapshot(source)).toBe(false);
  });

  test('returns null for whitespace-only metadata payload', () => {
    const source = `<svg><metadata id="${SNAPSHOT_METADATA_ID}">  \n\t  </metadata></svg>`;

    expect(extractSnapshotFromSvg(source)).toBeNull();
  });

  test('returns null for malformed base64/json payload', () => {
    const source = `<svg><metadata id="${SNAPSHOT_METADATA_ID}">%%%INVALID%%%</metadata></svg>`;

    expect(extractSnapshotFromSvg(source)).toBeNull();
  });

  test('returns null when envelope app marker does not match', () => {
    const wrongEnvelope = {
      app: 'someone-else',
      version: 1,
      createdAt: new Date().toISOString(),
      snapshot,
    };
    const payload = btoa(JSON.stringify(wrongEnvelope));
    const source = `<svg><metadata id="${SNAPSHOT_METADATA_ID}">${payload}</metadata></svg>`;

    expect(extractSnapshotFromSvg(source)).toBeNull();
  });

  test('returns null when envelope version is newer than supported', () => {
    const futureEnvelope = {
      app: 'handymeet',
      version: SNAPSHOT_FORMAT_VERSION + 1,
      createdAt: new Date().toISOString(),
      snapshot,
    };
    const payload = btoa(JSON.stringify(futureEnvelope));
    const source = `<svg><metadata id="${SNAPSHOT_METADATA_ID}">${payload}</metadata></svg>`;

    expect(extractSnapshotFromSvg(source)).toBeNull();
  });

  test('returns null when envelope snapshot is not an object', () => {
    const badSnapshotEnvelope = {
      app: 'handymeet',
      version: SNAPSHOT_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      snapshot: 'not-an-object',
    };
    const payload = btoa(JSON.stringify(badSnapshotEnvelope));
    const source = `<svg><metadata id="${SNAPSHOT_METADATA_ID}">${payload}</metadata></svg>`;

    expect(extractSnapshotFromSvg(source)).toBeNull();
  });
});
