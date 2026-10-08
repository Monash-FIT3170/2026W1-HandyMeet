'use client';

import { createPortal } from 'react-dom';
import { useEditor, useValue } from 'tldraw';

/** Keep pointer updates inside tldraw instead of re-rendering the board. */
export default function ShapeAuthorHover() {
  const editor = useEditor();
  const hovered = useValue(
    'shape author hover',
    () => {
      const id = editor.getHoveredShapeId();
      const shape = id ? editor.getShape(id) : undefined;
      const author = shape?.meta.author;
      const point = editor.inputs.currentScreenPoint;
      return typeof author === 'string'
        ? { author, x: point.x, y: point.y }
        : null;
    },
    [editor],
  );

  if (!hovered || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: hovered.x + 14,
        top: hovered.y - 36,
        background: 'rgba(20, 20, 20, 0.95)',
        color: '#fff',
        padding: '5px 11px',
        borderRadius: 6,
        fontSize: 13,
        pointerEvents: 'none',
        zIndex: 99999,
        whiteSpace: 'nowrap',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      ✏️ {hovered.author}
    </div>,
    document.body,
  );
}
