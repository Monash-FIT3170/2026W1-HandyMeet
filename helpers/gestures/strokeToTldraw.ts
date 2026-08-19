import { Editor, createShapeId } from 'tldraw';
import { b64Vecs } from '@tldraw/tlschema';
import type { DrawingStroke } from '@/hooks/useGestureDrawing';

export function addStrokeToTldraw(
  editor: Editor,
  stroke: DrawingStroke,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (stroke.length < 2) return;

  const camera = editor.getCamera();
  const viewportBounds = editor.getViewportScreenBounds();

  const pagePoints = stroke.map((point) => {
    const screenX = point.x * canvasWidth;
    const screenY = point.y * canvasHeight;

    const pageX = (screenX - viewportBounds.x) / camera.z - camera.x;
    const pageY = (screenY - viewportBounds.y) / camera.z - camera.y;

    return { x: pageX, y: pageY, z: 0.5 };
  });

  const minX = Math.min(...pagePoints.map((p) => p.x));
  const minY = Math.min(...pagePoints.map((p) => p.y));

  const localPoints = pagePoints.map((p) => ({
    x: p.x - minX,
    y: p.y - minY,
    z: p.z,
  }));

  const encodedPath = b64Vecs.encodePoints(localPoints, 3);

  editor.createShape({
    id: createShapeId(),
    type: 'draw',
    x: minX,
    y: minY,
    props: {
      segments: [
        {
          type: 'free',
          path: encodedPath,
        },
      ],
      color: 'blue',
      size: 'm',
      fill: 'none',
      dash: 'draw',
      isComplete: true,
      isClosed: false,
      isPen: false,
    },
  });
}
