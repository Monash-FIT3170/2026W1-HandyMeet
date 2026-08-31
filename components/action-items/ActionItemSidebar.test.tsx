import React from 'react';
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

describe('ActionItemSidebar', () => {
  test('renders the listening sidebar shell and empty state', () => {
    const markup = renderSidebar();

    expect(markup).toMatch(/>Action items</);
    expect(markup).toMatch(/>Listening</);
    expect(markup).toMatch(/aria-label="Collapse action items"/);
    expect(markup).toMatch(/No new action items yet/);
  });

  test('shows the checking state while loading', () => {
    const markup = renderSidebar({ isLoading: true });

    expect(markup).toMatch(/>Checking</);
    expect(markup).not.toMatch(/>Listening</);
  });

  test('renders supplied content instead of the empty state', () => {
    const markup = renderSidebar({ children: <p>Suggested action item</p> });

    expect(markup).toMatch(/Suggested action item/);
    expect(markup).not.toMatch(/No new action items yet/);
  });

  test('renders suggested action items', () => {
    const markup = renderSidebar({ items: [suggestion] });

    expect(markup).toMatch(/Suggestions/);
    expect(markup).toMatch(/Avery/);
    expect(markup).toMatch(/Prepare the sprint demonstration/);
    expect(markup).not.toMatch(/No new action items yet/);
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

    expect(markup).not.toMatch(/This dismissed task must stay hidden/);
    expect(markup).toMatch(/No new action items yet/);
  });

  test('hides the sidebar from assistive technology when collapsed', () => {
    const markup = renderSidebar({ open: false });

    expect(markup).toMatch(/aria-hidden="true"/);
    expect(markup).toMatch(/data-open="false"/);
    expect(markup).toMatch(/aria-label="Open action items"/);
  });

  test('shows the unread suggestion count on the collapsed launcher', () => {
    const markup = renderSidebar({ open: false, unreadCount: 3 });

    expect(markup).toMatch(
      /aria-label="Open action items, 3 unread suggestions"/,
    );
    expect(markup).toMatch(/data-unread-count="3"[^>]*>3</);
  });

  test('moves to the left of LiveKit Chat when Chat is open', () => {
    const markup = renderSidebar({ chatOpen: true });

    expect(markup).toMatch(/data-chat-open="true"/);
    expect(markup).toMatch(/right:calc\(clamp\(200px, 55ch, 60ch\) \+ 1rem\)/);
  });

  test('keeps dragged sidebar movement inside its bounds', () => {
    const bounds = { minX: -120, maxX: 0, minY: 0, maxY: 64 };

    expect(clampDragOffset({ x: 0, y: 0 }, { x: -200, y: 40 }, bounds)).toEqual(
      { x: -120, y: 40 },
    );
    expect(
      clampDragOffset({ x: -40, y: 20 }, { x: 80, y: 80 }, bounds),
    ).toEqual({ x: 0, y: 64 });
  });

  test('shows the expanded header as the sidebar drag handle', () => {
    const markup = renderSidebar();

    expect(markup).toMatch(/data-drag-handle="true"/);
    expect(markup).toMatch(/title="Drag to move action items"/);
  });

  test('renders the dark surface and glass highlight as separate backgrounds', () => {
    const markup = renderSidebar();

    expect(markup).toMatch(/background-color:rgba\(7,10,15,[^)]+\)/);
    expect(markup).toMatch(
      /background-image:linear-gradient\(145deg,rgba\(255,255,255,0.03\),transparent 20%\)/,
    );
  });

  test('moves accepted items into an initially collapsed Accepted section', () => {
    const markup = renderSidebar({ items: [suggestion, acceptedItem] });
    const suggestionsStart = markup.indexOf('Suggestions');
    const acceptedStart = markup.indexOf('Accepted');

    expect(suggestionsStart).toBeGreaterThanOrEqual(0);
    expect(acceptedStart).toBeGreaterThan(suggestionsStart);
    expect(markup.slice(suggestionsStart, acceptedStart)).toMatch(
      /Prepare the sprint demonstration/,
    );
    expect(markup.slice(suggestionsStart, acceptedStart)).not.toMatch(
      /Review the final presentation deck/,
    );
    expect(markup).toMatch(/aria-expanded="false"/);
    expect(markup).toMatch(
      /hidden=""[^>]*>[\s\S]*Review the final presentation deck/,
    );
  });

  test('shows an extraction error without removing suggestion cards', () => {
    const markup = renderSidebar({
      error: 'Could not check the latest transcript.',
      items: [suggestion],
    });

    expect(markup).toMatch(/Could not check the latest transcript/);
    expect(markup).toMatch(/Prepare the sprint demonstration/);
  });
});
