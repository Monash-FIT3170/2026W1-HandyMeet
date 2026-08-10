import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import ActionItemSidebar, { clampDragOffset } from './ActionItemSidebar';

const suggestion: LiveActionItem = {
  id: 'suggestion-1',
  task: 'Prepare the sprint demonstration',
  owner: 'Avery',
  dueDate: null,
  status: 'suggested',
  assigneeId: null,
};

const acceptedItem: LiveActionItem = {
  ...suggestion,
  id: 'accepted-1',
  task: 'Review the final presentation deck',
  owner: 'Jordan',
  status: 'accepted',
};

function renderSidebar({
  open = true,
  chatOpen = false,
  isLoading = false,
  error = null,
  unreadCount = 0,
  items = [],
  children,
}: {
  open?: boolean;
  chatOpen?: boolean;
  isLoading?: boolean;
  error?: string | null;
  unreadCount?: number;
  items?: LiveActionItem[];
  children?: React.ReactNode;
} = {}) {
  return renderToStaticMarkup(
    <ActionItemSidebar
      open={open}
      chatOpen={chatOpen}
      isLoading={isLoading}
      error={error}
      unreadCount={unreadCount}
      items={items}
      onCollapse={() => undefined}
      onExpand={() => undefined}
    >
      {children}
    </ActionItemSidebar>,
  );
}

test('renders the listening sidebar shell and empty state', () => {
  const markup = renderSidebar();

  assert.match(markup, />Action items</);
  assert.match(markup, />Listening</);
  assert.match(markup, /aria-label="Collapse action items"/);
  assert.match(markup, /No new action items yet/);
});

test('shows the checking state while loading', () => {
  const markup = renderSidebar({ isLoading: true });

  assert.match(markup, />Checking</);
  assert.doesNotMatch(markup, />Listening</);
});

test('renders supplied content instead of the empty state', () => {
  const markup = renderSidebar({ children: <p>Suggested action item</p> });

  assert.match(markup, /Suggested action item/);
  assert.doesNotMatch(markup, /No new action items yet/);
});

test('renders suggested action items', () => {
  const markup = renderSidebar({ items: [suggestion] });

  assert.match(markup, /Suggestions/);
  assert.match(markup, /Avery/);
  assert.match(markup, /Prepare the sprint demonstration/);
  assert.doesNotMatch(markup, /No new action items yet/);
});

test('keeps dismissed action items out of the visible list', () => {
  const markup = renderSidebar({
    items: [
      {
        ...suggestion,
        status: 'dismissed',
        task: 'This dismissed task must stay hidden',
      },
    ],
  });

  assert.doesNotMatch(markup, /This dismissed task must stay hidden/);
  assert.match(markup, /No new action items yet/);
});

test('hides the sidebar from assistive technology when collapsed', () => {
  const markup = renderSidebar({ open: false });

  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /data-open="false"/);
  assert.match(markup, /aria-label="Open action items"/);
});

test('shows the unread suggestion count on the collapsed launcher', () => {
  const markup = renderSidebar({ open: false, unreadCount: 3 });

  assert.match(markup, /aria-label="Open action items, 3 unread suggestions"/);
  assert.match(markup, /data-unread-count="3"[^>]*>3</);
});

test('moves to the left of LiveKit Chat when Chat is open', () => {
  const markup = renderSidebar({ chatOpen: true });

  assert.match(markup, /data-chat-open="true"/);
  assert.match(markup, /right:calc\(clamp\(200px, 55ch, 60ch\) \+ 1rem\)/);
});

test('keeps dragged sidebar movement inside its bounds', () => {
  const bounds = { minX: -120, maxX: 0, minY: 0, maxY: 64 };

  assert.deepEqual(
    clampDragOffset({ x: 0, y: 0 }, { x: -200, y: 40 }, bounds),
    { x: -120, y: 40 },
  );
  assert.deepEqual(
    clampDragOffset({ x: -40, y: 20 }, { x: 80, y: 80 }, bounds),
    { x: 0, y: 64 },
  );
});

test('shows the expanded header as the sidebar drag handle', () => {
  const markup = renderSidebar();

  assert.match(markup, /data-drag-handle="true"/);
  assert.match(markup, /title="Drag to move action items"/);
});

test('renders the dark surface and glass highlight as separate backgrounds', () => {
  const markup = renderSidebar();

  assert.match(markup, /background-color:rgba\(7,10,15,[^)]+\)/);
  assert.match(
    markup,
    /background-image:linear-gradient\(145deg,rgba\(255,255,255,0.03\),transparent 20%\)/,
  );
});

test('moves accepted items into an initially collapsed Accepted section', () => {
  const markup = renderSidebar({ items: [suggestion, acceptedItem] });
  const suggestionsStart = markup.indexOf('Suggestions');
  const acceptedStart = markup.indexOf('Accepted');

  assert.ok(suggestionsStart >= 0);
  assert.ok(acceptedStart > suggestionsStart);
  assert.match(
    markup.slice(suggestionsStart, acceptedStart),
    /Prepare the sprint demonstration/,
  );
  assert.doesNotMatch(
    markup.slice(suggestionsStart, acceptedStart),
    /Review the final presentation deck/,
  );
  assert.match(markup, /aria-expanded="false"/);
  assert.match(
    markup,
    /hidden=""[^>]*>[\s\S]*Review the final presentation deck/,
  );
});

test('shows an extraction error without removing suggestion cards', () => {
  const markup = renderSidebar({
    error: 'Could not check the latest transcript.',
    items: [suggestion],
  });

  assert.match(markup, /Could not check the latest transcript/);
  assert.match(markup, /Prepare the sprint demonstration/);
});
