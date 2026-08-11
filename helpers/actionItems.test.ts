import assert from 'node:assert/strict';
import test from 'node:test';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import {
  EMPTY_UNREAD_SUGGESTION_STATE,
  getNextUnreadSuggestionState,
  shouldAutoOpenActionItems,
} from './actionItems';

function makeItem(
  id: string,
  status: LiveActionItem['status'] = 'suggested',
): LiveActionItem {
  return {
    id,
    task: `Task ${id}`,
    owner: null,
    dueDate: null,
    status,
    assigneeId: null,
  };
}

test('counts only new suggestions received while the sidebar is collapsed', () => {
  const firstUpdate = getNextUnreadSuggestionState(
    EMPTY_UNREAD_SUGGESTION_STATE,
    [makeItem('one')],
    true,
  );
  const collapsedUpdate = getNextUnreadSuggestionState(
    firstUpdate,
    [
      makeItem('one'),
      makeItem('two'),
      makeItem('accepted', 'accepted'),
      makeItem('dismissed', 'dismissed'),
    ],
    false,
  );
  const repeatedUpdate = getNextUnreadSuggestionState(
    collapsedUpdate,
    [makeItem('one'), makeItem('two')],
    false,
  );

  assert.equal(collapsedUpdate.count, 1);
  assert.equal(repeatedUpdate.count, 1);
});

test('clears unread suggestions when the sidebar opens', () => {
  const collapsedUpdate = getNextUnreadSuggestionState(
    EMPTY_UNREAD_SUGGESTION_STATE,
    [makeItem('one'), makeItem('two')],
    false,
  );

  const openedUpdate = getNextUnreadSuggestionState(
    collapsedUpdate,
    [makeItem('one'), makeItem('two')],
    true,
  );

  assert.equal(collapsedUpdate.count, 2);
  assert.equal(openedUpdate.count, 0);
});

test('auto-opens only when the first action item arrives', () => {
  assert.equal(shouldAutoOpenActionItems(false, 0), false);
  assert.equal(shouldAutoOpenActionItems(false, 1), true);
  assert.equal(shouldAutoOpenActionItems(true, 2), false);
});
