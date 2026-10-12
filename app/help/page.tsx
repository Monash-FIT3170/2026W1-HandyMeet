import type { Metadata } from 'next';
import Link from 'next/link';
import FeatureGuide from '@/components/help/FeatureGuide';

export const metadata: Metadata = {
  title: 'Help & accessibility | HandyMeet',
  description:
    'Learn how to use HandyMeet meeting controls, captions, gestures, whiteboard, and live insights.',
};

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="inline-block rounded text-sm text-primary-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary-500"
      >
        Back to join a meeting
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Help &amp; accessibility</h1>
      <p className="mb-8 mt-3 text-neutral-200">
        Learn how to use HandyMeet and choose the controls that work for you.
      </p>
      <FeatureGuide />
    </main>
  );
}
