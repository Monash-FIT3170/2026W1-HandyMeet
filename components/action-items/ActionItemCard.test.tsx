import React from 'react';
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

describe('ActionItemCard', () => {
  test('renders Who and Task for an action item', () => {
    const markup = renderToStaticMarkup(<ActionItemCard item={actionItem} />);

    expect(markup).toMatch(/>Who</);
    expect(markup).toMatch(/Avery/);
    expect(markup).toMatch(/>Task</);
    expect(markup).toMatch(/Prepare the sprint demonstration/);
  });

  test('renders a due date only when one is supplied', () => {
    const withDueDate = renderToStaticMarkup(
      <ActionItemCard item={{ ...actionItem, dueDate: '2026-08-14' }} />,
    );
    const withoutDueDate = renderToStaticMarkup(
      <ActionItemCard item={actionItem} />,
    );

    expect(withDueDate).toMatch(/2026-08-14/);
    expect(withoutDueDate).not.toMatch(/>Due</);
  });

  test('renders action controls for a suggested item', () => {
    const markup = renderToStaticMarkup(<ActionItemCard item={actionItem} />);

    expect(markup).toMatch(/>Accept</);
    expect(markup).toMatch(/>Edit</);
    expect(markup).toMatch(/>Dismiss</);
  });

  test('keeps action controls off accepted items', () => {
    const markup = renderToStaticMarkup(
      <ActionItemCard item={{ ...actionItem, status: 'accepted' }} />,
    );

    expect(markup).not.toMatch(/>Accept</);
    expect(markup).not.toMatch(/>Edit</);
    expect(markup).not.toMatch(/>Dismiss</);
  });
});
