import type { LiveInsightActionItem } from './liveInsights';

export const LIVE_INSIGHTS_TOPIC = 'handymeet.live-insights';
export const LIVE_INSIGHTS_MESSAGE_TYPE = 'live_insights_update';
export const LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE =
  'live_insights_snapshot_request';

export type LiveInsightsUpdate = {
  type: typeof LIVE_INSIGHTS_MESSAGE_TYPE;
  actionItems: LiveInsightActionItem[];
};

export type LiveInsightsSnapshotRequest = {
  type: typeof LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE;
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
        typeof actionItem.task === 'string' &&
        (typeof actionItem.owner === 'string' || actionItem.owner === null) &&
        (typeof actionItem.dueDate === 'string' || actionItem.dueDate === null)
      );
    })
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
