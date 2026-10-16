/** @jest-environment jsdom */
import { createShapeId, createTLStore, type TLShape } from 'tldraw';
import {
  registerShapeDeletionGuard,
  registerShapeOwnership,
} from './shapeOwnership';

function shape(meta: TLShape['meta'] = {}): TLShape {
  return {
    id: createShapeId(),
    typeName: 'shape',
    type: 'draw',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1' as TLShape['index'],
    parentId: 'page:page' as TLShape['parentId'],
    isLocked: false,
    opacity: 1,
    props: {
      segments: [],
      color: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      isComplete: false,
      isClosed: false,
      isPen: false,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
    },
    meta,
  } as TLShape;
}

test('local creations are stamped; remote creations retain their author', () => {
  const store = createTLStore();
  const cleanup = registerShapeOwnership(store, 'alice', 'Same name');
  const local = shape();
  store.put([local]);
  expect(store.get(local.id)?.meta).toEqual({
    authorId: 'alice',
    author: 'Same name',
  });

  const remote = shape({ authorId: 'bob', author: 'Same name' });
  store.mergeRemoteChanges(() => store.put([remote]));
  expect(store.get(remote.id)?.meta).toEqual(remote.meta);
  cleanup();
});

test('guard blocks other identities, allows own and legacy shapes and remote deletes', () => {
  const store = createTLStore();
  const cleanup = registerShapeDeletionGuard(store, 'alice', 'Same name');
  const own = shape({ authorId: 'alice', author: 'Old name' });
  const other = shape({ authorId: 'bob', author: 'Same name' });
  const legacy = shape();
  store.put([own, other, legacy]);
  store.remove([own.id, other.id, legacy.id]);
  expect(store.get(own.id)).toBeUndefined();
  expect(store.get(legacy.id)).toBeUndefined();
  expect(store.get(other.id)).toBeDefined();
  store.mergeRemoteChanges(() => store.remove([other.id]));
  expect(store.get(other.id)).toBeUndefined();

  const oldOther = shape({ author: 'Bob' });
  store.put([oldOther]);
  store.remove([oldOther.id]);
  expect(store.get(oldOther.id)).toBeDefined();
  cleanup();
  store.remove([oldOther.id]);
  expect(store.get(oldOther.id)).toBeUndefined();
});
