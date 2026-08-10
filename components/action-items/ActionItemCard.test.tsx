import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import ActionItemCard from './ActionItemCard';

const actionItem: LiveActionItem = {
  id: 'action-item-1',
  task: 'Prepare the sprint demonstration',
  owner: 'Avery',
  dueDate: null,
  status: 'suggested',
  assigneeId: null,
};

test('renders Who and Task for an action item', () => {
  const markup = renderToStaticMarkup(<ActionItemCard item={actionItem} />);

  assert.match(markup, />Who</);
  assert.match(markup, /Avery/);
  assert.match(markup, />Task</);
  assert.match(markup, /Prepare the sprint demonstration/);
});

test('renders a due date only when one is supplied', () => {
  const withDueDate = renderToStaticMarkup(
    <ActionItemCard item={{ ...actionItem, dueDate: '2026-08-14' }} />,
  );
  const withoutDueDate = renderToStaticMarkup(
    <ActionItemCard item={actionItem} />,
  );

  assert.match(withDueDate, /2026-08-14/);
  assert.doesNotMatch(withoutDueDate, />Due</);
});

test('renders action controls for a suggested item', () => {
  const markup = renderToStaticMarkup(<ActionItemCard item={actionItem} />);

  assert.match(markup, />Accept</);
  assert.match(markup, />Edit</);
  assert.match(markup, />Dismiss</);
});

test('keeps action controls off accepted items', () => {
  const markup = renderToStaticMarkup(
    <ActionItemCard item={{ ...actionItem, status: 'accepted' }} />,
  );

  assert.doesNotMatch(markup, />Accept</);
  assert.doesNotMatch(markup, />Edit</);
  assert.doesNotMatch(markup, />Dismiss</);
});
