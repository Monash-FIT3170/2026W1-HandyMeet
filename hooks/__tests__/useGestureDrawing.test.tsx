/** @jest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { useGestureDrawing } from '../useGestureDrawing';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  detectDrawingGesture,
  getIndexFingerTip,
} from '@/helpers/gestures/drawingGestureDetector';
import { DrawingGesture } from '@/constants/gestures';

// needs to match SMOOTHING_WINDOW in the hook - feed this many identical
// frames and the average buffer is fully flushed, so we can check an exact
// position instead of doing the averaging math by hand
const SMOOTHING_WINDOW = 6;

jest.mock('@mediapipe/tasks-vision', () => ({
  HandLandmarker: {
    createFromOptions: jest.fn(),
  },
  FilesetResolver: {
    forVisionTasks: jest.fn(),
  },
}));

// detectDrawingGesture/getIndexFingerTip get tested on their own elsewhere,
// so here we just stub them out and control what each "hand" reports directly
jest.mock('@/helpers/gestures/drawingGestureDetector', () => ({
  detectDrawingGesture: jest.fn(),
  getIndexFingerTip: jest.fn(),
}));

let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;

function flushRAF() {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  callbacks.forEach((cb) => cb(performance.now()));
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeVideoMock(overrides: Partial<HTMLVideoElement> = {}) {
  const video = document.createElement('video');
  const defaults: Partial<HTMLVideoElement> = {
    readyState: 4,
    currentTime: 1,
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    Object.defineProperty(video, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  return video as HTMLVideoElement;
}

type FakeHand = {
  label: string;
  tip: { x: number; y: number } | null;
  gesture: DrawingGesture | null;
};

// stash the tip/gesture we want on a fake landmarks array so the mocked
// detector functions can just hand it straight back
function fakeLandmarks(hand: FakeHand) {
  const landmarks = [] as unknown as { __tip: FakeHand['tip'] } & {
    __gesture: FakeHand['gesture'];
  };
  landmarks.__tip = hand.tip;
  landmarks.__gesture = hand.gesture;
  return landmarks;
}

function resultsFor(hands: FakeHand[]) {
  return {
    landmarks: hands.map(fakeLandmarks),
    handedness: hands.map((h) => [{ categoryName: h.label, score: 0.9 }]),
  };
}

type HookOptions = Parameters<typeof useGestureDrawing>[0];

describe('useGestureDrawing', () => {
  let detectForVideo: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();

    rafCallbacks = [];
    rafIdCounter = 0;

    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafIdCounter;
    }) as unknown as typeof requestAnimationFrame;

    global.cancelAnimationFrame =
      jest.fn() as unknown as typeof cancelAnimationFrame;

    (detectDrawingGesture as jest.Mock).mockImplementation(
      (landmarks: ReturnType<typeof fakeLandmarks>) =>
        landmarks.__gesture ?? null,
    );
    (getIndexFingerTip as jest.Mock).mockImplementation(
      (landmarks: ReturnType<typeof fakeLandmarks>) => landmarks.__tip,
    );

    detectForVideo = jest.fn(() => resultsFor([]));
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close: jest.fn(),
    });
  });

  async function setup(options: Partial<HookOptions> = {}) {
    const videoRef = { current: makeVideoMock() };
    const onStrokeComplete = jest.fn();
    const onStrokeUpdate = jest.fn();

    let rendered!: ReturnType<
      typeof renderHook<ReturnType<typeof useGestureDrawing>, HookOptions>
    >;
    await act(async () => {
      rendered = renderHook((opts: HookOptions) => useGestureDrawing(opts), {
        initialProps: {
          videoRef,
          enabled: true,
          onStrokeComplete,
          onStrokeUpdate,
          ...options,
        } as HookOptions,
      });
      await flushPromises();
    });

    return { ...rendered, videoRef, onStrokeComplete, onStrokeUpdate };
  }

  // sets the next detectForVideo() result, bumps the video clock so the
  // hook doesn't skip it as a duplicate frame, then runs one RAF tick
  function tick(
    videoRef: { current: HTMLVideoElement },
    time: number,
    hands: FakeHand[],
  ) {
    Object.defineProperty(videoRef.current, 'currentTime', {
      value: time,
      configurable: true,
      writable: true,
    });
    detectForVideo.mockReturnValueOnce(resultsFor(hands));
    act(() => flushRAF());
  }

  // feeds the same hands SMOOTHING_WINDOW times so the average buffer is
  // entirely this value, returns the next free frame time to keep using
  function settle(
    videoRef: { current: HTMLVideoElement },
    startTime: number,
    hands: FakeHand[],
  ) {
    let t = startTime;
    for (let i = 0; i < SMOOTHING_WINDOW; i++) {
      tick(videoRef, t++, hands);
    }
    return t;
  }

  // averaging keeps introducing tiny float drift (0.8 vs 0.8000000000000002),
  // so check closeness here instead of exact equality
  function expectPoint(
    actual: { x: number; y: number } | null,
    expected: { x: number; y: number },
  ) {
    expect(actual).not.toBeNull();
    expect(actual!.x).toBeCloseTo(expected.x, 9);
    expect(actual!.y).toBeCloseTo(expected.y, 9);
  }

  function expectStroke(
    actual: { x: number; y: number }[],
    expected: { x: number; y: number }[],
  ) {
    expect(actual).toHaveLength(expected.length);
    actual.forEach((point, i) => expectPoint(point, expected[i]));
  }

  it('initializes HandLandmarker for 2 hands on mount', async () => {
    await setup();

    expect(HandLandmarker.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    );
  });

  it('closes the landmarker on unmount', async () => {
    const close = jest.fn();
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close,
    });

    const { unmount } = await setup();
    act(() => unmount());

    expect(close).toHaveBeenCalled();
  });

  it('resets state and stops the loop when disabled', async () => {
    const { rerender, result, videoRef } = await setup();
    tick(videoRef, 2, [
      { label: 'Right', tip: { x: 0.3, y: 0.4 }, gesture: null },
    ]);

    act(() => rerender({ videoRef, enabled: false } as HookOptions));

    expect(result.current.cursorPosition).toBeNull();
    expect(result.current.isDrawing).toBe(false);
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('tracks the only visible hand as the cursor, mirrored, and never starts drawing', async () => {
    const { result, videoRef } = await setup();

    tick(videoRef, 2, [
      { label: 'Right', tip: { x: 0.3, y: 0.4 }, gesture: DrawingGesture.Fist },
    ]);

    // mirrored for the selfie view: x -> 1 - x
    expect(result.current.cursorPosition).toEqual({ x: 0.7, y: 0.4 });
    // a lone hand has no second hand to act as control, so it can never draw
    expect(result.current.isDrawing).toBe(false);
  });

  it('assigns the fisted hand as control and starts drawing only after a few stable frames', async () => {
    const { result, videoRef, onStrokeUpdate } = await setup();
    const cursorTip = { x: 0.2, y: 0.5 };

    // frames 1-2: fisted, but not yet stable enough to commit to a stroke
    tick(videoRef, 2, [
      { label: 'Left', tip: cursorTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);
    expect(result.current.isDrawing).toBe(false);

    tick(videoRef, 3, [
      { label: 'Left', tip: cursorTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);
    expect(result.current.isDrawing).toBe(false);

    // 3rd consecutive fist frame: now stable
    tick(videoRef, 4, [
      { label: 'Left', tip: cursorTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);

    expect(result.current.isDrawing).toBe(true);
    expect(onStrokeUpdate).toHaveBeenCalledTimes(1);
    expectStroke(onStrokeUpdate.mock.calls[0][0], [
      { x: 1 - cursorTip.x, y: cursorTip.y },
    ]);
  });

  it('keeps the same control hand when it opens, instead of swapping to the other hand', async () => {
    const { result, videoRef, onStrokeComplete } = await setup();
    const leftTip = { x: 0.2, y: 0.5 };

    // get Right established as control and drawing
    for (const t of [2, 3, 4]) {
      tick(videoRef, t, [
        { label: 'Left', tip: leftTip, gesture: null },
        { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
      ]);
    }
    expect(result.current.isDrawing).toBe(true);

    // Right opens to a flat palm - drawing should stop...
    tick(videoRef, 5, [
      { label: 'Left', tip: leftTip, gesture: null },
      { label: 'Right', tip: null, gesture: null },
    ]);
    expect(result.current.isDrawing).toBe(false);
    expect(onStrokeComplete).toHaveBeenCalledTimes(1);

    // Left shouldn't become control just for being the "other" hand - cursor
    // should still be Left's tip, not whoever the array puts first
    const newLeftTip = { x: 0.25, y: 0.55 };
    settle(videoRef, 6, [
      { label: 'Left', tip: newLeftTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);
    expectPoint(result.current.cursorPosition, {
      x: 1 - newLeftTip.x,
      y: newLeftTip.y,
    });
  });

  it('stays on the same control hand when both hands are fisted at once', async () => {
    const { result, videoRef } = await setup();
    const leftTip = { x: 0.2, y: 0.5 };

    for (const t of [2, 3, 4]) {
      tick(videoRef, t, [
        { label: 'Left', tip: leftTip, gesture: null },
        { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
      ]);
    }

    // both fisted now - Right (already control) should stay control, not
    // jump to Left just because it's first in the array
    const newLeftTip = { x: 0.9, y: 0.9 };
    const rightTip = { x: 0.1, y: 0.1 };
    settle(videoRef, 5, [
      { label: 'Left', tip: newLeftTip, gesture: DrawingGesture.Fist },
      { label: 'Right', tip: rightTip, gesture: DrawingGesture.Fist },
    ]);

    expectPoint(result.current.cursorPosition, {
      x: 1 - newLeftTip.x,
      y: newLeftTip.y,
    });
  });

  it('keeps the control hand sticky across a momentary single-hand frame', async () => {
    const { result, videoRef } = await setup();
    const leftTip = { x: 0.2, y: 0.5 };

    for (const t of [2, 3, 4]) {
      tick(videoRef, t, [
        { label: 'Left', tip: leftTip, gesture: null },
        { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
      ]);
    }
    expect(result.current.isDrawing).toBe(true);

    // Right (control) briefly drops out of tracking entirely
    tick(videoRef, 5, [{ label: 'Left', tip: leftTip, gesture: null }]);

    // both hands back now - Right should still be control and Left still
    // the cursor, nothing should have swapped
    const newLeftTip = { x: 0.33, y: 0.44 };
    settle(videoRef, 6, [
      { label: 'Left', tip: newLeftTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);
    expectPoint(result.current.cursorPosition, {
      x: 1 - newLeftTip.x,
      y: newLeftTip.y,
    });
  });

  it('ends the stroke and starts a fresh one with no phantom line when the drawing hand switches', async () => {
    const { result, videoRef, onStrokeComplete, onStrokeUpdate } =
      await setup();
    const leftTip = { x: 0.1, y: 0.1 };

    for (const t of [2, 3, 4]) {
      tick(videoRef, t, [
        { label: 'Left', tip: leftTip, gesture: null },
        { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
      ]);
    }
    expect(result.current.isDrawing).toBe(true);
    onStrokeComplete.mockClear();
    onStrokeUpdate.mockClear();

    // swap: Left fists, Right opens - Right becomes the new cursor hand
    const rightTip = { x: 0.8, y: 0.8 };
    tick(videoRef, 5, [
      { label: 'Left', tip: null, gesture: DrawingGesture.Fist },
      { label: 'Right', tip: rightTip, gesture: null },
    ]);

    // the old stroke (near leftTip) should have been closed off...
    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
    const closedStroke = onStrokeComplete.mock.calls[0][0];
    expectPoint(closedStroke[closedStroke.length - 1], {
      x: 1 - leftTip.x,
      y: leftTip.y,
    });

    // ...and drawing should continue immediately at the new hand's position,
    // as a brand new stroke with no point connecting back to the old hand
    expect(result.current.isDrawing).toBe(true);
    expectStroke(onStrokeUpdate.mock.calls[0][0], [
      { x: 1 - rightTip.x, y: rightTip.y },
    ]);
  });

  it('rejects a single-frame position jump without ending the stroke', async () => {
    const { result, videoRef, onStrokeComplete, onStrokeUpdate } =
      await setup();
    const nearTip = { x: 0.1, y: 0.1 };

    for (const t of [2, 3, 4]) {
      tick(videoRef, t, [
        { label: 'Left', tip: nearTip, gesture: null },
        { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
      ]);
    }
    expect(result.current.isDrawing).toBe(true);
    onStrokeUpdate.mockClear();

    // a huge, implausible one-frame jump in the cursor hand's position
    const farTip = { x: 0.95, y: 0.95 };
    tick(videoRef, 5, [
      { label: 'Left', tip: farTip, gesture: null },
      { label: 'Right', tip: null, gesture: DrawingGesture.Fist },
    ]);

    expect(result.current.isDrawing).toBe(true);
    expect(onStrokeComplete).not.toHaveBeenCalled();
    expect(onStrokeUpdate).not.toHaveBeenCalled();
  });

  it('smooths the cursor position over the last few raw frames', async () => {
    const { result, videoRef } = await setup();

    const xs = [0.1, 0.2, 0.3];
    for (const [i, x] of xs.entries()) {
      tick(videoRef, i + 2, [
        { label: 'Right', tip: { x, y: 0.5 }, gesture: null },
      ]);
    }

    const mirroredAvg = 1 - (0.1 + 0.2 + 0.3) / 3;
    expect(result.current.cursorPosition!.x).toBeCloseTo(mirroredAvg, 5);
  });
});
