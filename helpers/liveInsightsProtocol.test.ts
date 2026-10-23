import {
  isLiveInsightsMutation,
  isLiveInsightsUpdate,
  LIVE_INSIGHTS_MESSAGE_TYPE,
  LIVE_INSIGHTS_MUTATION_TYPE,
} from './liveInsightsProtocol';

const actionItem = {
  id: 'item-1',
  task: 'Send the report',
  owner: 'Alice',
  dueDate: '2026-10-30',
  status: 'suggested',
  assigneeId: 'alice',
};

describe('isLiveInsightsUpdate', () => {
  test.each(['suggested', 'accepted', 'dismissed'])(
    'accepts an action item with status %s',
    (status) => {
      expect(
        isLiveInsightsUpdate({
          type: LIVE_INSIGHTS_MESSAGE_TYPE,
          actionItems: [{ ...actionItem, status }],
        }),
      ).toBe(true);
    },
  );

  test('accepts an empty snapshot and nullable item fields', () => {
    expect(
      isLiveInsightsUpdate({
        type: LIVE_INSIGHTS_MESSAGE_TYPE,
        actionItems: [],
      }),
    ).toBe(true);
    expect(
      isLiveInsightsUpdate({
        type: LIVE_INSIGHTS_MESSAGE_TYPE,
        actionItems: [
          { ...actionItem, owner: null, dueDate: null, assigneeId: null },
        ],
      }),
    ).toBe(true);
  });

  test.each([
    null,
    undefined,
    false,
    1,
    'update',
    [],
    {},
    { type: 'other', actionItems: [] },
    { type: LIVE_INSIGHTS_MESSAGE_TYPE },
    { type: LIVE_INSIGHTS_MESSAGE_TYPE, actionItems: {} },
  ])('rejects a malformed update: %p', (value) => {
    expect(isLiveInsightsUpdate(value)).toBe(false);
  });

  test.each([
    null,
    'item',
    {},
    { ...actionItem, id: '' },
    { ...actionItem, id: 1 },
    { ...actionItem, task: null },
    { ...actionItem, owner: undefined },
    { ...actionItem, owner: 1 },
    { ...actionItem, dueDate: undefined },
    { ...actionItem, dueDate: 1 },
    { ...actionItem, status: 'pending' },
    { ...actionItem, assigneeId: undefined },
    { ...actionItem, assigneeId: 1 },
  ])(
    'rejects the whole snapshot when an item is invalid: %p',
    (invalidItem) => {
      expect(
        isLiveInsightsUpdate({
          type: LIVE_INSIGHTS_MESSAGE_TYPE,
          actionItems: [actionItem, invalidItem],
        }),
      ).toBe(false);
    },
  );
});

describe('isLiveInsightsMutation', () => {
  const mutation = { type: LIVE_INSIGHTS_MUTATION_TYPE, itemId: 'item-1' };

  test.each(['accept', 'dismiss'])(
    'accepts the %s operation without extra fields',
    (operation) => {
      expect(isLiveInsightsMutation({ ...mutation, operation })).toBe(true);
    },
  );

  test.each(['alice', null])('accepts assignment to %p', (assigneeId) => {
    expect(
      isLiveInsightsMutation({ ...mutation, operation: 'assign', assigneeId }),
    ).toBe(true);
  });

  test.each([undefined, 1, false, {}])(
    'rejects assignment to %p',
    (assigneeId) => {
      expect(
        isLiveInsightsMutation({
          ...mutation,
          operation: 'assign',
          assigneeId,
        }),
      ).toBe(false);
    },
  );

  test.each([
    { task: 'Send a revised report' },
    { owner: 'Bob' },
    { owner: null },
    { dueDate: '2026-11-01' },
    { dueDate: null },
    { task: '', owner: null, dueDate: null },
  ])('accepts editable fields: %p', (updates) => {
    expect(
      isLiveInsightsMutation({ ...mutation, operation: 'edit', updates }),
    ).toBe(true);
  });

  test.each([
    undefined,
    null,
    'task',
    [],
    {},
    { task: null },
    { owner: 1 },
    { dueDate: 1 },
    { status: 'accepted' },
    { task: 'Valid task', assigneeId: 'alice' },
  ])('rejects invalid or unauthorized edits: %p', (updates) => {
    expect(
      isLiveInsightsMutation({ ...mutation, operation: 'edit', updates }),
    ).toBe(false);
  });

  test.each([
    null,
    undefined,
    false,
    'mutation',
    [],
    {},
    { ...mutation, type: 'other', operation: 'accept' },
    { ...mutation, itemId: undefined, operation: 'accept' },
    { ...mutation, itemId: 1, operation: 'accept' },
    { ...mutation, itemId: '', operation: 'accept' },
    mutation,
    { ...mutation, operation: 'delete' },
  ])('rejects a malformed mutation: %p', (value) => {
    expect(isLiveInsightsMutation(value)).toBe(false);
  });
});
