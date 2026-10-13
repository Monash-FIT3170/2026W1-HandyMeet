'use client';

import { LiveActionItemsTestPage } from '@/app/test/live-action-items/LiveActionItemsTestPage';

export default function OfflineLiveActionItemsTestPage() {
  return <LiveActionItemsTestPage agentAvailable={false} />;
}
