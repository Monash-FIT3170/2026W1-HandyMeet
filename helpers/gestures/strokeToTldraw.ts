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

  // screenX/screenY are already relative to the tldraw container's own
  // top-left (GestureDrawingOverlay and the Tldraw component both fill the
  // same containerRef with position:absolute; inset:0), which is the same
  // origin editor.getViewportScreenBounds() would subtract out, so no
  // separate viewport offset needs to be applied here.
  const pagePoints = stroke.map((point) => {
    const screenX = point.x * canvasWidth;
    const screenY = point.y * canvasHeight;

    const pageX = screenX / camera.z - camera.x;
    const pageY = screenY / camera.z - camera.y;

    return { x: pageX, y: pageY, z: 0.5 };
  });

  let minX = Infinity;
  let minY = Infinity;
  for (const p of pagePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  }

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
