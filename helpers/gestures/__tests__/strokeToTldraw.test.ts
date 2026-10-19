/** @jest-environment jsdom */
import { b64Vecs } from '@tldraw/tlschema';
import type { Editor } from 'tldraw';
import { addStrokeToTldraw } from '../strokeToTldraw';

describe('addStrokeToTldraw', () => {
  const getCamera = jest.fn(() => ({ x: 0, y: 0, z: 1 }));
  const createShape = jest.fn();
  const editor = { getCamera, createShape } as unknown as Editor;

  beforeEach(() => {
    jest.clearAllMocks();
    getCamera.mockReturnValue({ x: 0, y: 0, z: 1 });
  });

  it.each([{ stroke: [] }, { stroke: [{ x: 0.5, y: 0.5 }] }])(
    'ignores strokes with fewer than two points ($stroke)',
    ({ stroke }) => {
      addStrokeToTldraw(editor, stroke, 800, 400);

      expect(getCamera).not.toHaveBeenCalled();
      expect(createShape).not.toHaveBeenCalled();
    },
  );

  it('creates a completed blue draw shape from normalized coordinates', () => {
    addStrokeToTldraw(
      editor,
      [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.75 },
      ],
      800,
      400,
    );

    expect(createShape).toHaveBeenCalledTimes(1);
    const shape = createShape.mock.calls[0][0];
    expect(shape).toEqual({
      id: expect.stringMatching(/^shape:/),
      type: 'draw',
      x: 200,
      y: 100,
      props: {
        segments: [{ type: 'free', path: expect.any(String) }],
        color: 'blue',
        size: 'm',
        fill: 'none',
        dash: 'draw',
        isComplete: true,
        isClosed: false,
        isPen: false,
      },
    });
    expect(b64Vecs.decodePoints(shape.props.segments[0].path, 3)).toEqual([
      { x: 0, y: 0, z: 0.5 },
      { x: 400, y: 200, z: 0.5 },
    ]);
  });

  it('applies camera pan and zoom and anchors at independent coordinate minima', () => {
    getCamera.mockReturnValue({ x: 150, y: -20, z: 2 });

    addStrokeToTldraw(
      editor,
      [
        { x: 0.75, y: 0.5 },
        { x: 0.25, y: 0.75 },
        { x: 0.5, y: 0.25 },
      ],
      800,
      400,
    );

    expect(createShape).toHaveBeenCalledTimes(1);
    const shape = createShape.mock.calls[0][0];
    expect(shape).toMatchObject({ x: -50, y: 70 });
    expect(b64Vecs.decodePoints(shape.props.segments[0].path, 3)).toEqual([
      { x: 200, y: 50, z: 0.5 },
      { x: 0, y: 100, z: 0.5 },
      { x: 100, y: 0, z: 0.5 },
    ]);
  });
});
