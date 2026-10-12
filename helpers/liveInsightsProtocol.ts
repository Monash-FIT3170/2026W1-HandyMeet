import type {
  LiveInsightActionItem,
  LiveInsightActionItemFields,
} from './liveInsights';

export const LIVE_INSIGHTS_TOPIC = 'handymeet.live-insights';
export const LIVE_INSIGHTS_MESSAGE_TYPE = 'live_insights_update';
export const LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE =
  'live_insights_snapshot_request';
export const LIVE_INSIGHTS_MUTATION_TYPE = 'live_insights_mutation';
export const LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE =
  'live_insights_coordinator_claim';
export const LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE =
  'live_insights_coordinator_handoff';
export const LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE =
  'live_insights_coordinator_state_request';
export const LIVE_INSIGHTS_COORDINATOR_STATE_TYPE =
  'live_insights_coordinator_state';

export type LiveInsightsUpdate = {
  type: typeof LIVE_INSIGHTS_MESSAGE_TYPE;
  actionItems: LiveInsightActionItem[];
};

export type LiveInsightsSnapshotRequest = {
  type: typeof LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE;
};

export type LiveInsightsCoordinatorClaim = {
  type: typeof LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE;
  joinedAt: number;
};

export type LiveInsightsCoordinatorHandoff = {
  type: typeof LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE;
  targetIdentity: string;
};

export type LiveInsightsCoordinatorStateRequest = {
  type: typeof LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE;
};

export type LiveInsightsCoordinatorState = {
  type: typeof LIVE_INSIGHTS_COORDINATOR_STATE_TYPE;
  coordinatorIdentity: string | null;
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
        (typeof actionItem.dueDate === 'string' ||
          actionItem.dueDate === null) &&
        (actionItem.status === 'suggested' ||
          actionItem.status === 'accepted' ||
          actionItem.status === 'dismissed') &&
        (typeof actionItem.assigneeId === 'string' ||
          actionItem.assigneeId === null)
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

export function isLiveInsightsCoordinatorClaim(
  value: unknown,
): value is LiveInsightsCoordinatorClaim {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as {
    type?: unknown;
    joinedAt?: unknown;
  };

  return (
    message.type === LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE &&
    typeof message.joinedAt === 'number' &&
    Number.isFinite(message.joinedAt) &&
    message.joinedAt >= 0
  );
}

export function isLiveInsightsCoordinatorHandoff(
  value: unknown,
): value is LiveInsightsCoordinatorHandoff {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as {
    type?: unknown;
    targetIdentity?: unknown;
  };

  return (
    message.type === LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE &&
    typeof message.targetIdentity === 'string' &&
    message.targetIdentity.length > 0
  );
}

export function isLiveInsightsCoordinatorStateRequest(
  value: unknown,
): value is LiveInsightsCoordinatorStateRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type ===
      LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE
  );
}

export function isLiveInsightsCoordinatorState(
  value: unknown,
): value is LiveInsightsCoordinatorState {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as {
    type?: unknown;
    coordinatorIdentity?: unknown;
  };

  return (
    message.type === LIVE_INSIGHTS_COORDINATOR_STATE_TYPE &&
    (typeof message.coordinatorIdentity === 'string' ||
      message.coordinatorIdentity === null)
  );
}
