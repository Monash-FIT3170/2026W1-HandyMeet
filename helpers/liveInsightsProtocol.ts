import type {
  LiveInsightActionItem,
  LiveInsightActionItemFields,
} from './liveInsights';

export const LIVE_INSIGHTS_TOPIC = 'handymeet.live-insights';
export const LIVE_INSIGHTS_MESSAGE_TYPE = 'live_insights_update';
export const LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE =
  'live_insights_snapshot_request';
export const LIVE_INSIGHTS_MUTATION_TYPE = 'live_insights_mutation';

export type LiveInsightsUpdate = {
  type: typeof LIVE_INSIGHTS_MESSAGE_TYPE;
  actionItems: LiveInsightActionItem[];
};

export type LiveInsightsSnapshotRequest = {
  type: typeof LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE;
};

export type LiveInsightsMutation =
  | {
      type: typeof LIVE_INSIGHTS_MUTATION_TYPE;
      itemId: string;
      operation: 'accept' | 'dismiss';
    }
  | {
      type: typeof LIVE_INSIGHTS_MUTATION_TYPE;
      itemId: string;
      operation: 'edit';
      updates: Partial<LiveInsightActionItemFields>;
    }
  | {
      type: typeof LIVE_INSIGHTS_MUTATION_TYPE;
      itemId: string;
      operation: 'assign';
      assigneeId: string | null;
    };

export function isLiveInsightsUpdate(
  value: unknown,
): value is LiveInsightsUpdate {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as {
    type?: unknown;
    actionItems?: unknown;
  };

  return (
    message.type === LIVE_INSIGHTS_MESSAGE_TYPE &&
    Array.isArray(message.actionItems) &&
    message.actionItems.every((item) => {
      if (typeof item !== 'object' || item === null) return false;

      const actionItem = item as Partial<LiveInsightActionItem>;
      return (
        typeof actionItem.id === 'string' &&
        actionItem.id.length > 0 &&
        typeof actionItem.task === 'string' &&
        (typeof actionItem.owner === 'string' || actionItem.owner === null) &&
        (typeof actionItem.dueDate === 'string' || actionItem.dueDate === null)
      );
    })
  );
}

export function isLiveInsightsMutation(
  value: unknown,
): value is LiveInsightsMutation {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as {
    type?: unknown;
    itemId?: unknown;
    operation?: unknown;
    updates?: unknown;
    assigneeId?: unknown;
  };

  if (
    message.type !== LIVE_INSIGHTS_MUTATION_TYPE ||
    typeof message.itemId !== 'string' ||
    message.itemId.length === 0
  ) {
    return false;
  }

  if (message.operation === 'accept' || message.operation === 'dismiss') {
    return true;
  }

  if (message.operation === 'assign') {
    return (
      typeof message.assigneeId === 'string' || message.assigneeId === null
    );
  }

  if (message.operation !== 'edit') return false;
  if (typeof message.updates !== 'object' || message.updates === null) {
    return false;
  }

  const updates = message.updates as Record<string, unknown>;
  const allowedFields = ['task', 'owner', 'dueDate'];
  if (
    Object.keys(updates).some((field) => !allowedFields.includes(field)) ||
    Object.keys(updates).length === 0
  ) {
    return false;
  }

  return (
    (updates.task === undefined || typeof updates.task === 'string') &&
    (updates.owner === undefined ||
      typeof updates.owner === 'string' ||
      updates.owner === null) &&
    (updates.dueDate === undefined ||
      typeof updates.dueDate === 'string' ||
      updates.dueDate === null)
  );
}

export function isLiveInsightsSnapshotRequest(
  value: unknown,
): value is LiveInsightsSnapshotRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE
  );
}
