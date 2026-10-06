/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
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

// --- Fake RAF: jsdom ships requestAnimationFrame, but we want deterministic
// manual control over when frames fire, so we still stub it ourselves. ---
let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;

function flushRAF() {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  callbacks.forEach((cb) => cb(performance.now()));
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// --- Fake video/canvas: jsdom gives us real HTMLVideoElement/HTMLCanvasElement
// shells, but jsdom's canvas has no real 2D context implementation, so we still
// stub getContext. Using real elements (rather than plain objects) means any
// property access the hook makes that we *didn't* think to mock (e.g. instanceof
// checks, nodeName) behaves correctly instead of silently returning undefined. ---
function makeVideoMock(overrides: Partial<HTMLVideoElement> = {}) {
  const video = document.createElement('video');

  const defaults: Partial<HTMLVideoElement> = {
    readyState: 4,
    currentTime: 1,
    videoWidth: 640,
    videoHeight: 480,
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

function makeCanvasMock(overrides: Partial<HTMLCanvasElement> = {}) {
  const canvas = document.createElement('canvas');
  const ctx = {
    clearRect: jest.fn(),
    save: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    restore: jest.fn(),
  };

  const canvasDefaults: Partial<HTMLCanvasElement> = {
    clientWidth: 320,
    clientHeight: 240,
    ...overrides,
  };
  for (const [key, value] of Object.entries(canvasDefaults)) {
    Object.defineProperty(canvas, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  canvas.getContext = jest.fn(() => ctx) as unknown as typeof canvas.getContext;

  return { canvas, ctx };
}

type HookOptions = Parameters<typeof useHandLandmarker>[0];

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
      renderHook((options: HookOptions) => useHandLandmarker(options), {
        initialProps: {
          videoRef,
          canvasRef,
          trackingEnabled: false,
          overlayEnabled: false,
        } as HookOptions,
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

    let unmount!: () => void;
    await act(async () => {
      const rendered = renderHook(
        (options: HookOptions) => useHandLandmarker(options),
        {
          initialProps: {
            videoRef,
            canvasRef,
            trackingEnabled: false,
            overlayEnabled: false,
          } as HookOptions,
        },
      );
      unmount = rendered.unmount;
      await flushPromises();
    });

    act(() => unmount());

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
      renderHook((options: HookOptions) => useHandLandmarker(options), {
        initialProps: {
          videoRef,
          canvasRef,
          trackingEnabled: false,
          overlayEnabled: false,
        } as HookOptions,
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
      renderHook((options: HookOptions) => useHandLandmarker(options), {
        initialProps: {
          videoRef,
          canvasRef,
          trackingEnabled: true,
          overlayEnabled: false,
        } as HookOptions,
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

    let result!: ReturnType<
      typeof renderHook<ReturnType<typeof useHandLandmarker>, HookOptions>
    >['result'];
    await act(async () => {
      const rendered = renderHook(
        (options: HookOptions) => useHandLandmarker(options),
        {
          initialProps: {
            videoRef,
            canvasRef,
            trackingEnabled: true,
            overlayEnabled: true,
            onLandmarksSnapshot,
            snapshotIntervalMs: 0,
          } as HookOptions,
        },
      );
      result = rendered.result;
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
    expect(result.current.isTracking).toBe(true);
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
      renderHook((options: HookOptions) => useHandLandmarker(options), {
        initialProps: {
          videoRef,
          canvasRef,
          trackingEnabled: true,
          overlayEnabled: false,
        } as HookOptions,
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
      renderHook((options: HookOptions) => useHandLandmarker(options), {
        initialProps: {
          videoRef,
          canvasRef,
          trackingEnabled: true,
          overlayEnabled: false,
        } as HookOptions,
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

    let rerender!: (options: HookOptions) => void;
    await act(async () => {
      const rendered = renderHook(
        (options: HookOptions) => useHandLandmarker(options),
        {
          initialProps: {
            videoRef,
            canvasRef,
            trackingEnabled: true,
            overlayEnabled: false,
          } as HookOptions,
        },
      );
      rerender = rendered.rerender;
      await flushPromises();
    });

    act(() => {
      rerender({
        videoRef,
        canvasRef,
        trackingEnabled: false,
        overlayEnabled: false,
      } as HookOptions);
    });

    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });
});
