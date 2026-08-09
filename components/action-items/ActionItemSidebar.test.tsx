import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import ActionItemSidebar from './ActionItemSidebar';

const suggestion: LiveActionItem = {
  id: 'suggestion-1',
  task: 'Prepare the sprint demonstration',
  owner: 'Avery',
  dueDate: null,
  status: 'suggested',
  assigneeId: null,
};

function renderSidebar({
  open = true,
  isLoading = false,
  items = [],
  children,
}: {
  open?: boolean;
  isLoading?: boolean;
  items?: LiveActionItem[];
  children?: React.ReactNode;
} = {}) {
  return renderToStaticMarkup(
    <ActionItemSidebar
      open={open}
      isLoading={isLoading}
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
