'use client';

import { useState } from 'react';
import ActionItemSidebar from '@/components/action-items/ActionItemSidebar';
import {
  EMPTY_UNREAD_SUGGESTION_STATE,
  getNextUnreadSuggestionState,
  shouldAutoOpenActionItems,
} from '@/helpers/actionItems';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import type { ParticipantOption } from '@/hooks/useMeetingParticipants';

const firstItem: LiveActionItem = {
  id: 'playwright-first-item',
  task: 'Prepare the sprint demo',
  owner: 'Param',
  dueDate: '2026-08-21',
  status: 'suggested',
  assigneeId: null,
};

const secondItem: LiveActionItem = {
  id: 'playwright-second-item',
  task: 'Review the presentation',
  owner: 'Naveen',
  dueDate: null,
  status: 'suggested',
  assigneeId: null,
};

const mockParticipants: ParticipantOption[] = [
  { id: 'dylan', name: 'Dylan' },
  { id: 'sam', name: 'Sam' },
];

export default function ActionItemsTestPage() {
  const [items, setItems] = useState<LiveActionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadSuggestions, setUnreadSuggestions] = useState(
    EMPTY_UNREAD_SUGGESTION_STATE,
  );
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  function addItem(item: LiveActionItem) {
    if (items.some((currentItem) => currentItem.id === item.id)) return;

    const nextItems = [...items, item];
    const autoOpen = shouldAutoOpenActionItems(hasAutoOpened, nextItems.length);
    const nextOpen = open || autoOpen;

    setItems(nextItems);
    setOpen(nextOpen);
    if (autoOpen) setHasAutoOpened(true);
    setUnreadSuggestions((current) =>
      getNextUnreadSuggestionState(current, nextItems, nextOpen),
    );
  }

  function updateItem(id: string, patch: Partial<LiveActionItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function acceptItem(id: string, ownerName?: string) {
    updateItem(id, {
      status: 'accepted',
      ...(ownerName ? { owner: ownerName } : {}),
    });
  }

  function dismissItem(id: string) {
    updateItem(id, { status: 'dismissed' });
  }

  function editItem(id: string, newTask: string) {
    updateItem(id, { task: newTask });
  }

  function assignUser(id: string, assigneeId: string | null) {
    updateItem(id, { assigneeId });
  }

  function expandSidebar() {
    setOpen(true);
    setUnreadSuggestions((current) =>
      getNextUnreadSuggestionState(current, items, true),
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-lg font-bold">Action items test playground</h1>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          onClick={() => addItem(firstItem)}
          disabled={items.some((item) => item.id === firstItem.id)}
        >
          Add first item
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          onClick={() => addItem(secondItem)}
          disabled={items.some((item) => item.id === secondItem.id)}
        >
          Add another item
        </button>
      </div>

      <ActionItemSidebar
        open={open}
        chatOpen={false}
        isLoading={false}
        error={null}
        unreadCount={unreadSuggestions.count}
        items={items}
        participants={mockParticipants}
        onCollapse={() => setOpen(false)}
        onExpand={expandSidebar}
        onAccept={acceptItem}
        onEdit={editItem}
        onDismiss={dismissItem}
        onAssign={assignUser}
      />
    </main>
  );
}
