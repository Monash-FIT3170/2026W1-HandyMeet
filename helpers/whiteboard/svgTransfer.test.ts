/** @jest-environment jsdom */

import {
  exportWhiteboardToSvg,
  importWhiteboardFromSvg,
  type ExportResult,
  type ImportResult,
} from './svgTransfer';

jest.mock('tldraw', () => {
  const actual = jest.requireActual('tldraw');
  return {
    ...actual,
    getSnapshot: jest.fn(),
    loadSnapshot: jest.fn(),
    AssetRecordType: {
      createId: jest.fn(() => 'asset:mock-id'),
    },
  };
});

import { getSnapshot, loadSnapshot } from 'tldraw';

type ShapeIdSet = {
  size: number;
  [Symbol.iterator]: () => Iterator<string>;
};

type MockEditor = {
  store: object;
  getCurrentPageShapeIds: jest.Mock<ShapeIdSet, []>;
  getSvgString: jest.Mock<Promise<{ svg?: string }>, [unknown, unknown]>;
  getViewportPageBounds: jest.Mock<
    { width: number; height: number; center: { x: number; y: number } },
    []
  >;
  deleteShapes: jest.Mock<void, [string[]]>;
  createAssets: jest.Mock<void, [unknown[]]>;
  createShape: jest.Mock<void, [unknown]>;
  putContentOntoCurrentPage: jest.Mock<void, [unknown, unknown]>;
};

const ids = (...values: string[]): ShapeIdSet => {
  const set = new Set(values);
  return {
    size: set.size,
    [Symbol.iterator]: () => set.values(),
  };
};

const makeSnapshot = (store: Record<string, unknown> = {}) => ({
  document: {
    schema: { schemaVersion: 2, sequences: {} },
    store,
  },
  session: {},
});

const makeEditor = (): MockEditor => ({
  store: {},
  getCurrentPageShapeIds: jest.fn(() => ids('shape:1')),
  getSvgString: jest.fn().mockResolvedValue({ svg: '<svg><rect /></svg>' }),
  getViewportPageBounds: jest.fn(() => ({
    width: 1000,
    height: 800,
    center: { x: 500, y: 400 },
  })),
  deleteShapes: jest.fn(),
  createAssets: jest.fn(),
  createShape: jest.fn(),
  putContentOntoCurrentPage: jest.fn(),
});

describe('exportWhiteboardToSvg', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const realCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-18T08:30:00.000Z'));
    (getSnapshot as jest.Mock).mockReturnValue(makeSnapshot());

    const link = {
      href: '',
      download: '',
      rel: '',
      click: jest.fn(),
    };

    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return link as unknown as HTMLAnchorElement;
      return realCreateElement(tagName);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:mock-whiteboard-export'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      configurable: true,
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('returns empty when there are no shapes to export', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids());

    const result = await exportWhiteboardToSvg(editor as unknown as never);

    expect(result).toEqual<ExportResult>({ status: 'empty' });
    expect(editor.getSvgString).not.toHaveBeenCalled();
  });

  test('exports svg with embedded snapshot and triggers browser download', async () => {
    const editor = makeEditor();

    const result = await exportWhiteboardToSvg(editor as unknown as never);
    jest.runOnlyPendingTimers();

    expect(result.status).toBe('success');
    expect(editor.getSvgString).toHaveBeenCalledWith(['shape:1'], {
      background: true,
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:mock-whiteboard-export',
    );
  });

  test('returns error when svg rendering yields no svg output', async () => {
    const editor = makeEditor();
    editor.getSvgString.mockResolvedValue({});

    const result = await exportWhiteboardToSvg(editor as unknown as never);

    expect(result).toEqual({
      status: 'error',
      message: 'Could not render the whiteboard.',
    });
  });

  test('returns normalized error when export throws non-Error', async () => {
    const editor = makeEditor();
    editor.getSvgString.mockRejectedValue('boom');

    const result = await exportWhiteboardToSvg(editor as unknown as never);

    expect(result).toEqual({ status: 'error', message: 'Export failed.' });
  });

  test('returns native error message when export throws Error', async () => {
    const editor = makeEditor();
    editor.getSvgString.mockRejectedValue(new Error('disk full'));

    const result = await exportWhiteboardToSvg(editor as unknown as never);

    expect(result).toEqual({ status: 'error', message: 'disk full' });
  });
});

describe('importWhiteboardFromSvg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fileOf = (name: string, contents: string): File =>
    ({
      name,
      text: jest.fn().mockResolvedValue(contents),
    }) as unknown as File;

  test('returns invalid when content is not an svg', async () => {
    const editor = makeEditor();
    const file = fileOf('notes.txt', 'plain text');

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      file,
    );

    expect(result).toEqual<ImportResult>({
      status: 'invalid',
      message: "notes.txt doesn't look like an SVG file.",
    });
  });

  test('restores snapshot in replace mode via loadSnapshot', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids('shape:1', 'shape:2'));

    const snapshot = makeSnapshot({
      'shape:imported': {
        id: 'shape:imported',
        typeName: 'shape',
        type: 'draw',
        parentId: 'page:page',
      },
    });

    const embed = await import('./svgSnapshot');
    const svg = embed.embedSnapshotInSvg(
      '<svg><rect /></svg>',
      snapshot as never,
    );

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('board.svg', svg),
      {
        chooseMode: () => 'replace',
      },
    );

    expect(loadSnapshot).toHaveBeenCalledWith(editor.store, snapshot);
    expect(result).toEqual({
      status: 'restored',
      shapeCount: 2,
      mode: 'replace',
    });
  });

  test('cancels when chooseMode returns null', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids('shape:1'));

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('board.svg', '<svg><rect /></svg>'),
      {
        chooseMode: () => null,
      },
    );

    expect(result).toEqual({ status: 'cancelled' });
  });

  test('restores snapshot in add mode via putContentOntoCurrentPage', async () => {
    const editor = makeEditor();

    const importedShape = {
      id: 'shape:imported',
      typeName: 'shape',
      type: 'draw',
      parentId: 'page:page',
    };
    const importedChild = {
      id: 'shape:child',
      typeName: 'shape',
      type: 'draw',
      parentId: 'shape:imported',
    };
    const importedBinding = {
      id: 'binding:1',
      typeName: 'binding',
      fromId: 'shape:imported',
      toId: 'shape:child',
    };
    const importedAsset = {
      id: 'asset:1',
      typeName: 'asset',
      type: 'image',
    };

    const snapshot = makeSnapshot({
      'shape:imported': importedShape,
      'shape:child': importedChild,
      'binding:1': importedBinding,
      'asset:1': importedAsset,
      'page:page': { id: 'page:page', typeName: 'page' },
    });

    const embed = await import('./svgSnapshot');
    const svg = embed.embedSnapshotInSvg(
      '<svg><rect /></svg>',
      snapshot as never,
    );

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('saved-board.svg', svg),
    );

    expect(editor.putContentOntoCurrentPage).toHaveBeenCalledTimes(1);
    const [content, opts] = editor.putContentOntoCurrentPage.mock.calls[0];
    expect((content as { shapes: unknown[] }).shapes).toHaveLength(2);
    expect((content as { rootShapeIds: string[] }).rootShapeIds).toEqual([
      'shape:imported',
    ]);
    expect(opts).toEqual({ select: true });
    expect(result).toEqual({ status: 'restored', shapeCount: 2, mode: 'add' });
  });

  test('returns invalid when snapshot exists but has no shapes', async () => {
    const editor = makeEditor();

    const emptySnapshot = makeSnapshot({
      'page:page': { id: 'page:page', typeName: 'page' },
    });

    const embed = await import('./svgSnapshot');
    const svg = embed.embedSnapshotInSvg(
      '<svg><rect /></svg>',
      emptySnapshot as never,
    );

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('empty-board.svg', svg),
    );

    expect(result).toEqual({
      status: 'invalid',
      message: 'empty-board.svg has no shapes to import.',
    });
  });

  test('places foreign svg as image in add mode', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids());

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf(
        'foreign.svg',
        '<svg width="400" height="200"><rect width="400" height="200" /></svg>',
      ),
    );

    expect(editor.createAssets).toHaveBeenCalledTimes(1);
    expect(editor.createShape).toHaveBeenCalledTimes(1);

    const [[asset]] = editor.createAssets.mock.calls;
    expect((asset as unknown[])[0]).toMatchObject({
      id: 'asset:mock-id',
      type: 'image',
      props: expect.objectContaining({
        name: 'foreign.svg',
        w: 400,
        h: 200,
        mimeType: 'image/svg+xml',
      }),
    });

    expect(result).toEqual({ status: 'placed', mode: 'add' });
  });

  test('replace mode clears current page before placing foreign svg', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids('shape:1', 'shape:2'));

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('foreign.svg', '<svg width="300" height="150"></svg>'),
      {
        chooseMode: () => 'replace',
      },
    );

    expect(editor.deleteShapes).toHaveBeenCalledWith(['shape:1', 'shape:2']);
    expect(result).toEqual({ status: 'placed', mode: 'replace' });
  });

  test('falls back to viewBox/fallback dimensions for foreign svg placement', async () => {
    const editor = makeEditor();
    editor.getCurrentPageShapeIds.mockReturnValue(ids());

    await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('viewbox.svg', '<svg viewBox="0 0 500 250"></svg>'),
    );

    const [shapeFromViewBox] = editor.createShape.mock.calls[0];
    expect(
      (shapeFromViewBox as { props: { w: number; h: number } }).props,
    ).toEqual(expect.objectContaining({ w: 500, h: 250 }));

    editor.createShape.mockClear();

    await importWhiteboardFromSvg(
      editor as unknown as never,
      fileOf('percent.svg', '<svg width="100%" height="50%"></svg>'),
    );

    const [shapeFromFallback] = editor.createShape.mock.calls[0];
    expect(
      (shapeFromFallback as { props: { w: number; h: number } }).props,
    ).toEqual(expect.objectContaining({ w: 640, h: 480 }));
  });

  test('returns error result when file reading throws', async () => {
    const editor = makeEditor();

    const badFile = {
      name: 'bad.svg',
      text: jest.fn().mockRejectedValue(new Error('read failed')),
    } as unknown as File;

    const result = await importWhiteboardFromSvg(
      editor as unknown as never,
      badFile,
    );

    expect(result).toEqual({ status: 'error', message: 'read failed' });
  });
});
