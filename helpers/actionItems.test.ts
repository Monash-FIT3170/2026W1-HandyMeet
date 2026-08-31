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

describe('actionItems helpers', () => {
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

    expect(collapsedUpdate.count).toBe(1);
    expect(repeatedUpdate.count).toBe(1);
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

    expect(collapsedUpdate.count).toBe(2);
    expect(openedUpdate.count).toBe(0);
  });

  test('auto-opens only when the first action item arrives', () => {
    expect(shouldAutoOpenActionItems(false, 0)).toBe(false);
    expect(shouldAutoOpenActionItems(false, 1)).toBe(true);
    expect(shouldAutoOpenActionItems(true, 2)).toBe(false);
  });
});
