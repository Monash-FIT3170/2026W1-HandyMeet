import type { LiveInsightActionItem } from './liveInsights';

export const LIVE_INSIGHTS_TOPIC = 'handymeet.live-insights';
export const LIVE_INSIGHTS_MESSAGE_TYPE = 'live_insights_update';

export type LiveInsightsUpdate = {
  type: typeof LIVE_INSIGHTS_MESSAGE_TYPE;
  actionItems: LiveInsightActionItem[];
};
