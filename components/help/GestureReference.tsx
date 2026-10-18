'use client';

import { useRef } from 'react';
import referenceData from '@/constants/gestureReference.json';
import { CaptionGesture } from '@/constants/captions';
import { Reaction, REACTION_MAP } from '@/constants/reactions';

const fingers = [
  { name: 'Thumb', colour: '#fbbf24', points: [0, 1, 2, 3, 4] },
  { name: 'Index', colour: '#60a5fa', points: [0, 5, 6, 7, 8] },
  { name: 'Middle', colour: '#a78bfa', points: [5, 9, 10, 11, 12] },
  { name: 'Ring', colour: '#f472b6', points: [9, 13, 14, 15, 16] },
  { name: 'Little', colour: '#34d399', points: [13, 17, 18, 19, 20] },
];
type ReferenceLabel = keyof typeof referenceData;
const actions: { label: ReferenceLabel; title: string; result: string }[] = [
  { label: 'mute', title: 'Mute', result: 'Your microphone turns off.' },
  { label: 'unmute', title: 'Unmute', result: 'Your microphone turns on.' },
  {
    label: 'cameraOff',
    title: 'Camera off',
    result:
      'Your shared video turns off. Hand tracking stays on locally. Use the camera button to turn video on again.',
  },
  {
    label: 'endCall',
    title: 'Request to leave',
    result: 'The leave confirmation opens. Choose Cancel or Leave Call.',
  },
];

function GestureCard({
  label,
  title,
  result,
}: {
  label: ReferenceLabel;
  title: string;
  result: string;
}) {
  const example = referenceData[label];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const diagram = (
    <svg
      viewBox="0 0 260 210"
      role="img"
      aria-label={`${title}: camera-facing hand-position diagram. ${example.instructions.join(' ')}`}
      className="w-full rounded bg-neutral-950"
    >
      {example.hands.map((hand, index) => (
        <g key={index}>
          <polygon
            points={[0, 5, 9, 13, 17].map((i) => hand[i].join(',')).join(' ')}
            fill="none"
            stroke="#d4d4d4"
            strokeWidth="2"
          />
          {fingers.map((finger) => (
            <g key={finger.name}>
              <polyline
                points={finger.points.map((i) => hand[i].join(',')).join(' ')}
                fill="none"
                stroke={finger.colour}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={hand[finger.points.at(-1)!][0]}
                cy={hand[finger.points.at(-1)!][1]}
                r="5"
                fill={finger.colour}
              />
              <text
                x={hand[finger.points.at(-1)!][0] + 7}
                y={hand[finger.points.at(-1)!][1] + 4}
                fill="white"
                fontSize="12"
              >
                {fingers.indexOf(finger) + 1}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
  return (
    <figure className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
      <figcaption className="font-semibold text-primary-200">
        {title}
      </figcaption>
      <p className="mt-1 text-xs text-neutral-200">
        {example.hands.length === 2 ? 'Use both hands' : 'Use one hand'} · Hold
        about one second
      </p>
      <button
        type="button"
        aria-label={`Enlarge ${title} gesture reference`}
        onClick={() => dialogRef.current?.showModal()}
        className="my-2 block w-full cursor-zoom-in rounded focus-visible:outline-2 focus-visible:outline-primary-500"
      >
        {diagram}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={`${title} gesture reference`}
        onKeyDown={(event) => event.stopPropagation()}
        onCancel={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[min(44rem,calc(100%-2rem))] max-w-none overflow-y-auto rounded-xl border border-neutral-600 bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/70"
      >
        <div className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-600 focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              Close
            </button>
          </div>
          {diagram}
        </div>
      </dialog>
      <p className="mt-2 text-sm text-neutral-100">{result}</p>
    </figure>
  );
}

export default function GestureReference() {
  return (
    <div className="mt-5 border-t border-neutral-700 pt-4">
      <h3 className="font-semibold text-primary-200">Gesture reference</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-200">
        Copy the finger arrangement and orientation shown, as viewed by the
        camera. These schematics show hand positions, not full-body signs. Dots
        mark fingertips; the numbers identify each finger. For two-hand
        examples, match the relative positions of both hands.
      </p>
      <p className="mt-2 text-xs text-neutral-200">
        1 Thumb · 2 Index · 3 Middle · 4 Ring · 5 Little finger
      </p>
      <p className="mt-2 text-sm text-neutral-200">
        Start with a reaction such as thumbs up. Release between attempts. Keep
        tracking off while browsing if you do not want an accidental action.
        Recognition may still fail even when a pose looks similar.
      </p>
      {[
        { title: 'Meeting actions', examples: actions },
        {
          title: 'Reactions',
          examples: Object.values(Reaction).map((label) => ({
            label,
            title:
              label === Reaction.RaiseHand
                ? 'Raise hand'
                : REACTION_MAP[label].label.replace(/^Says /, ''),
            result: `Other participants see a banner: ${REACTION_MAP[label].label}.`,
          })),
        },
        {
          title: 'Letters and words',
          examples: Object.values(CaptionGesture).map((label) => ({
            label,
            title: label,
            result: `“${label}” appears as a temporary gesture caption.`,
          })),
        },
      ].map((group) => (
        <details
          key={group.title}
          className="mt-3 rounded-lg border border-neutral-700 p-3"
        >
          <summary className="cursor-pointer rounded font-semibold text-primary-200 focus-visible:outline-2 focus-visible:outline-primary-500">
            {group.title} ({group.examples.length})
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.examples.map((example) => (
              <GestureCard key={example.label} {...example} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
