import type { Editor, TLShape } from 'tldraw';

/** Stamp only local creations; snapshots and remote diffs retain ownership. */
export function registerShapeOwnership(
  editor: Pick<Editor, 'sideEffects'>,
  identity: string,
  name: string,
) {
  return editor.sideEffects.registerBeforeCreateHandler(
    'shape',
    (shape, source) =>
      source === 'user'
        ? {
            ...shape,
            meta: { ...shape.meta, authorId: identity, author: name },
          }
        : shape,
  );
}

export function canDeleteShape(shape: TLShape, identity: string, name: string) {
  if (typeof shape.meta.authorId === 'string') {
    return shape.meta.authorId === identity;
  }
  // Older boards stored only a display name. Unattributed shapes stay editable.
  return typeof shape.meta.author !== 'string' || shape.meta.author === name;
}

export function registerShapeDeletionGuard(
  editor: Pick<Editor, 'sideEffects'>,
  identity: string,
  name: string,
) {
  return editor.sideEffects.registerBeforeDeleteHandler(
    'shape',
    (shape, source) => {
      if (source === 'user' && !canDeleteShape(shape, identity, name))
        return false;
    },
  );
}
