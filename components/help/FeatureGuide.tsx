import {
  featureHelp,
  meetingHelp,
  type FeatureHelpContent,
  type HelpContext,
} from '@/constants/featureHelp';
import GestureReference from './GestureReference';

export default function FeatureGuide({
  idPrefix = 'help',
  variant = 'full',
}: {
  idPrefix?: string;
  variant?: 'full' | HelpContext;
}) {
  const features: readonly FeatureHelpContent[] =
    variant === 'meeting'
      ? meetingHelp
      : variant === 'whiteboard'
        ? featureHelp.filter((feature) => feature.id === 'whiteboard')
        : featureHelp;
  return (
    <div className="space-y-6">
      {variant === 'full' && (
        <>
          <nav aria-label="Guide sections" className="flex flex-wrap gap-2">
            {features.map((feature) => (
              <a
                key={feature.id}
                href={`#${idPrefix}-${feature.id}`}
                className="rounded-full border border-neutral-600 px-3 py-2 text-sm text-primary-200 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                {feature.title}
              </a>
            ))}
          </nav>
          <article
            className="rounded-xl border border-primary-700 bg-neutral-950 p-5"
            aria-labelledby={`${idPrefix}-start-title`}
          >
            <h2
              id={`${idPrefix}-start-title`}
              className="text-lg font-semibold text-primary-200"
            >
              Your first meeting
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-100">
              <li>
                Enter your name and a room code, or leave the code empty to
                create a room. Select Join Room.
              </li>
              <li>
                Allow microphone and camera access. Check their controls in the
                bottom toolbar.
              </li>
              <li>
                Ask someone to speak. Captions appear when transcription is
                available; open Captions to adjust them.
              </li>
              <li>
                Try Chat or Whiteboard. Gestures are optional: enable Hand
                tracking only when you are ready to use the reference.
              </li>
              <li>
                When finished, select Leave → Leave Call, then Download to keep
                your notes before closing.
              </li>
            </ol>
          </article>
        </>
      )}
      <details className="rounded-lg border border-neutral-700 p-4">
        <summary className="cursor-pointer rounded font-semibold text-primary-200 focus-visible:outline-2 focus-visible:outline-primary-500">
          Keyboard navigation and control alternatives
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-neutral-200">
          Use Tab and Shift + Tab to move through buttons, links, and guide
          topics. Use Enter to follow links and Enter or Space on buttons and
          expandable topics. Arrow keys adjust the caption-size slider. Escape
          closes this help dialog and returns focus to its trigger; on the full
          guide page, use Back to join a meeting.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-200">
          Camera gestures are optional. Use microphone and camera buttons
          instead of gesture actions, Chat instead of gesture text, and the
          canvas tools instead of Gesture Draw. Caption settings affect only
          your view. The whiteboard has its own canvas controls; these
          instructions do not imply every canvas task can be performed with Tab
          alone.
        </p>
      </details>
      <div className="space-y-6">
        {features.map((feature) => (
          <section
            key={feature.id}
            id={`${idPrefix}-${feature.id}`}
            aria-labelledby={`${idPrefix}-${feature.id}-title`}
            className="scroll-mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6"
          >
            <h2
              id={`${idPrefix}-${feature.id}-title`}
              className="text-lg font-semibold text-primary-200"
            >
              {feature.title}
            </h2>
            <p className="mt-2 text-neutral-200">{feature.description}</p>
            {feature.requirement && (
              <p className="mt-4 border-l-2 border-primary-500 pl-3 text-sm leading-relaxed text-primary-200">
                {feature.requirement}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {feature.tasks.map((task) => (
                <details
                  key={task.title}
                  className="rounded-lg border border-neutral-700 p-4"
                >
                  <summary className="cursor-pointer rounded font-semibold text-primary-200 focus-visible:outline-2 focus-visible:outline-primary-500">
                    {task.title}
                  </summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-100">
                    {task.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-200">
                    <strong className="text-neutral-100">
                      What you should see:{' '}
                    </strong>
                    {task.outcome}
                  </p>
                  {task.troubleshooting && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-200">
                      <strong className="text-neutral-100">
                        If it doesn’t work:{' '}
                      </strong>
                      {task.troubleshooting}
                    </p>
                  )}
                </details>
              ))}
            </div>
            {feature.id === 'gestures' && <GestureReference />}
          </section>
        ))}
      </div>
    </div>
  );
}
