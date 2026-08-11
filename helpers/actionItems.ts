import type { LiveActionItem } from '@/hooks/useLiveActionItems';

export type UnreadSuggestionState = {
  suggestionIds: string[];
  count: number;
};

export const EMPTY_UNREAD_SUGGESTION_STATE: UnreadSuggestionState = {
  suggestionIds: [],
  count: 0,
};

export function shouldAutoOpenActionItems(
  hasAutoOpened: boolean,
  itemCount: number,
): boolean {
  return !hasAutoOpened && itemCount > 0;
}

export function getNextUnreadSuggestionState(
  current: UnreadSuggestionState,
  items: LiveActionItem[],
  sidebarOpen: boolean,
): UnreadSuggestionState {
  const previousIds = new Set(current.suggestionIds);
  const suggestionIds = items
    .filter((item) => item.status === 'suggested')
    .map((item) => item.id);
  const newSuggestionCount = suggestionIds.filter(
    (id) => !previousIds.has(id),
  ).length;

  return {
    suggestionIds,
    count: sidebarOpen ? 0 : current.count + newSuggestionCount,
  };
}
