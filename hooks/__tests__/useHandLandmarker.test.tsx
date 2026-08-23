import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useHandLandmarker } from '../useHandLandmarker';
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';
import { buildHandFeatureVectors } from '@/helpers/gestures/handLandmarkFeatures';

jest.mock('@mediapipe/tasks-vision', () => ({
  HandLandmarker: {
    createFromOptions: jest.fn(),
    HAND_CONNECTIONS: [],
  },
  FilesetResolver: {
    forVisionTasks: jest.fn(),
  },
  DrawingUtils: jest.fn().mockImplementation(() => ({
    drawConnectors: jest.fn(),
    drawLandmarks: jest.fn(),
  })),
}));

jest.mock('@/helpers/gestures/handLandmarkFeatures', () => ({
  buildHandFeatureVectors: jest.fn(() => ({})),
}));

// --- Fake RAF: Node has neither requestAnimationFrame nor cancelAnimationFrame ---
let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;

function flushRAF() {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  callbacks.forEach((cb) => cb(performance.now()));
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// --- Fake video/canvas: plain objects, no real DOM needed under node env ---
function makeVideoMock(overrides: Partial<HTMLVideoElement> = {}) {
  return {
    readyState: 4,
    currentTime: 1,
    videoWidth: 640,
    videoHeight: 480,
    ...overrides,
  } as unknown as HTMLVideoElement;
}

function makeCanvasMock(overrides: Partial<HTMLCanvasElement> = {}) {
  const ctx = {
    clearRect: jest.fn(),
    save: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    restore: jest.fn(),
  };
  const canvas = {
    clientWidth: 320,
    clientHeight: 240,
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
    ...overrides,
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx };
}

type HookOptions = Parameters<typeof useHandLandmarker>[0];
type HookResult = ReturnType<typeof useHandLandmarker>;

function HookHarness({
  options,
  onResult,
}: {
  options: HookOptions;
  onResult: (result: HookResult) => void;
}) {
  const result = useHandLandmarker(options);
  onResult(result);
  return null;
}

function renderHookHarness(options: HookOptions) {
  let latest: HookResult = { isTracking: false };
  const onResult = (result: HookResult) => {
    latest = result;
  };

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <HookHarness options={options} onResult={onResult} />,
    );
  });

  return {
    getResult: () => latest,
    rerender: (nextOptions: HookOptions) => {
      act(() => {
        renderer.update(
          <HookHarness options={nextOptions} onResult={onResult} />,
        );
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

describe('useHandLandmarker', () => {
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

    (DrawingUtils as unknown as jest.Mock).mockImplementation(() => ({
      drawConnectors: jest.fn(),
      drawLandmarks: jest.fn(),
    }));
  });

  it('initializes HandLandmarker with expected options on mount', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo: jest.fn(),
      close: jest.fn(),
    });

    const videoRef = { current: makeVideoMock() };
    const canvasRef = { current: makeCanvasMock().canvas };

    await act(async () => {
      renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: false,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        baseOptions: expect.objectContaining({ delegate: 'GPU' }),
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    );
  });

  it('closes the landmarker instance on unmount', async () => {
    const close = jest.fn();
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo: jest.fn(),
      close,
    });

    const videoRef = { current: makeVideoMock() };
    const canvasRef = { current: makeCanvasMock().canvas };

    let harness!: ReturnType<typeof renderHookHarness>;
    await act(async () => {
      harness = renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: false,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    act(() => harness.unmount());

    expect(close).toHaveBeenCalled();
  });

  it('clears the canvas and does not start the detection loop when trackingEnabled is false', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo: jest.fn(),
      close: jest.fn(),
    });

    const videoRef = { current: makeVideoMock() };
    const { canvas, ctx } = makeCanvasMock();
    const canvasRef = { current: canvas };

    await act(async () => {
      renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: false,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    expect(ctx.clearRect).toHaveBeenCalledWith(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    expect(global.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('re-queues the frame without detecting when the video is not ready', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    const detectForVideo = jest.fn();
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close: jest.fn(),
    });

    const videoRef = { current: makeVideoMock({ readyState: 1 }) }; // below the readyState < 2 threshold
    const { canvas } = makeCanvasMock();
    const canvasRef = { current: canvas };

    await act(async () => {
      renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: true,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    act(() => flushRAF());

    expect(detectForVideo).not.toHaveBeenCalled();
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2); // initial queue + re-queue
  });

  it('runs detection, draws the overlay, and emits a snapshot when hands are detected', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    const landmarksResult = {
      landmarks: [[{ x: 0.5, y: 0.5 }]],
      handedness: [[{ categoryName: 'Right', score: 0.9 }]],
    };
    const detectForVideo = jest.fn(() => landmarksResult);
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close: jest.fn(),
    });
    (buildHandFeatureVectors as jest.Mock).mockReturnValue({ mock: 'vectors' });

    const drawConnectors = jest.fn();
    const drawLandmarks = jest.fn();
    (DrawingUtils as unknown as jest.Mock).mockImplementation(() => ({
      drawConnectors,
      drawLandmarks,
    }));

    const videoRef = { current: makeVideoMock({ currentTime: 5 }) };
    const { canvas, ctx } = makeCanvasMock();
    const canvasRef = { current: canvas };
    const onLandmarksSnapshot = jest.fn();

    let harness!: ReturnType<typeof renderHookHarness>;
    await act(async () => {
      harness = renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: true,
        overlayEnabled: true,
        onLandmarksSnapshot,
        snapshotIntervalMs: 0,
      });
      await flushPromises();
    });

    act(() => flushRAF());

    expect(detectForVideo).toHaveBeenCalledWith(
      videoRef.current,
      expect.any(Number),
    );
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(drawConnectors).toHaveBeenCalled();
    expect(drawLandmarks).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(harness.getResult().isTracking).toBe(true);
    expect(onLandmarksSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarks: landmarksResult.landmarks,
        handedness: landmarksResult.handedness,
        featureVectors: { mock: 'vectors' },
      }),
    );
  });

  it('skips drawing the overlay when overlayEnabled is false, but still clears the canvas', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    const detectForVideo = jest.fn(() => ({
      landmarks: [[{ x: 0.5, y: 0.5 }]],
      handedness: [[{ categoryName: 'Right', score: 0.9 }]],
    }));
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close: jest.fn(),
    });

    const drawConnectors = jest.fn();
    (DrawingUtils as unknown as jest.Mock).mockImplementation(() => ({
      drawConnectors,
      drawLandmarks: jest.fn(),
    }));

    const videoRef = { current: makeVideoMock() };
    const { canvas, ctx } = makeCanvasMock();
    const canvasRef = { current: canvas };

    await act(async () => {
      renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: true,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    act(() => flushRAF());

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(drawConnectors).not.toHaveBeenCalled();
  });

  it('does not re-run detection for the same video frame', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    const detectForVideo = jest.fn(() => ({ landmarks: [], handedness: [] }));
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo,
      close: jest.fn(),
    });

    const videoRef = { current: makeVideoMock({ currentTime: 3 }) };
    const { canvas } = makeCanvasMock();
    const canvasRef = { current: canvas };

    await act(async () => {
      renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: true,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    act(() => flushRAF()); // processes frame at currentTime=3
    act(() => flushRAF()); // currentTime unchanged, should skip

    expect(detectForVideo).toHaveBeenCalledTimes(1);
  });

  it('cancels the animation frame loop when trackingEnabled turns off', async () => {
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});
    (HandLandmarker.createFromOptions as jest.Mock).mockResolvedValue({
      detectForVideo: jest.fn(() => ({ landmarks: [], handedness: [] })),
      close: jest.fn(),
    });

    const videoRef = { current: makeVideoMock() };
    const canvasRef = { current: makeCanvasMock().canvas };

    let harness!: ReturnType<typeof renderHookHarness>;
    await act(async () => {
      harness = renderHookHarness({
        videoRef,
        canvasRef,
        trackingEnabled: true,
        overlayEnabled: false,
      });
      await flushPromises();
    });

    act(() => {
      harness.rerender({
        videoRef,
        canvasRef,
        trackingEnabled: false,
        overlayEnabled: false,
      });
    });

    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });
});
