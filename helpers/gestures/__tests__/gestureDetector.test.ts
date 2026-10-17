import type { Room } from 'livekit-client';

/**
 * All collaborators are mocked so the tests only exercise the decision logic
 * in gestureDetector.ts. Values are chosen to be exactly representable in
 * float32 (0.5, 0.75, 0.125, ...) so threshold-boundary assertions are exact.
 */
jest.mock('@tensorflow/tfjs', () => {
  class Tensor {
    data = jest.fn();
    dispose = jest.fn();
  }
  return {
    Tensor,
    loadLayersModel: jest.fn(),
    tensor2d: jest.fn(() => new Tensor()),
  };
});

jest.mock('@/constants/gestures', () => ({
  Gesture: { Wave: 'wave', ThumbsUp: 'thumbs_up', Clap: 'clap' },
  MULTI_HAND_CONFIDENCE_THRESHOLD: 0.75,
  SINGLE_HAND_CONFIDENCE_THRESHOLD: 0.5,
  TWO_HAND_GESTURES: new Set(['clap']),
  TWO_HAND_PREFERENCE_MARGIN: 0.125,
}));

jest.mock('@/constants/reactions', () => ({
  Reaction: { Heart: 'heart' },
}));

jest.mock('@/constants/captions', () => ({
  CaptionGesture: { CaptionA: 'caption_a' },
}));

jest.mock('@/scripts/gesture-recognition/model_labels.json', () => ({
  __esModule: true,
  default: ['wave', 'thumbs_up', 'heart', 'caption_a', 'clap', 'unmapped'],
}));

jest.mock('../handLandmarkFeatures', () => ({ VALUES_PER_HAND: 4 }));

jest.mock('../../filtering/gesture-filter', () => ({
  processGesture: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utilities', () => ({
  getLandmarkCoordinatesFromFeatures: jest.fn((_f: number[], i: number) => ({
    x: i,
    y: i,
    z: i,
  })),
  calculateDistance3D: jest.fn(() => 1),
  calculatePalmDistance: jest.fn(() => 2),
  sentinelArray: jest.fn((value: number, length: number) =>
    Array.from({ length }, () => value),
  ),
}));

// Module under test: ../gestureDetector
type Subject = typeof import('../gestureDetector');
type Hands = Parameters<Subject['predictGestureAction']>[1];

const VALUES_PER_HAND = 4;
const FEATURE_LEN = VALUES_PER_HAND * 2;
const ENGINEERED_LEN = 10 + 10 + 26;
const MODEL_INPUT_SIZE = FEATURE_LEN + ENGINEERED_LEN;
const LABELS = ['wave', 'thumbs_up', 'heart', 'caption_a', 'clap', 'unmapped'];

const room = {} as Room;
const requestLeave = jest.fn();

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let subject: Subject;
let tf: any;
let utilities: any;
let processGesture: jest.Mock;
let model: { predict: jest.Mock; inputs: any[] };

const scoresFor = (label: string, score: number) => {
  const scores = new Float32Array(LABELS.length);
  scores[LABELS.indexOf(label)] = score;
  return scores;
};

/** Queue one model output per upcoming `predict` call (left, right, both order). */
const queuePredictions = (
  ...predictions: Array<{ label: string; score: number }>
) => {
  predictions.forEach(({ label, score }) => {
    const tensor = new tf.Tensor();
    tensor.data.mockResolvedValue(scoresFor(label, score));
    model.predict.mockReturnValueOnce(tensor);
  });
};

const hands = (overrides: Partial<Hands> = {}): Hands =>
  ({ left: null, right: null, both: null, ...overrides }) as Hands;

const LEFT = [1, 1, 1, 1, 1, 1, 1, 1];
const RIGHT = [2, 2, 2, 2, 2, 2, 2, 2];
const BOTH = [1, 1, 1, 1, 2, 2, 2, 2];

const run = (
  featureVectors: Hands,
  leave: (() => void) | undefined = requestLeave,
) => subject.predictGestureAction(room, featureVectors, leave);

beforeEach(() => {
  // The module caches the model promise at module scope, so reload it each test.
  jest.resetModules();
  tf = jest.requireMock('@tensorflow/tfjs');
  utilities = jest.requireMock('../utilities');
  processGesture = jest.requireMock(
    '../../filtering/gesture-filter',
  ).processGesture;

  model = { predict: jest.fn(), inputs: [{ shape: [null, MODEL_INPUT_SIZE] }] };
  tf.loadLayersModel.mockResolvedValue(model);

  subject = require('../gestureDetector');
});

describe('predictGestureAction', () => {
  describe('no hands', () => {
    it('reports a null action without loading the model', async () => {
      await run(hands());

      expect(processGesture).toHaveBeenCalledTimes(1);
      expect(processGesture).toHaveBeenCalledWith(room, null, requestLeave);
      expect(tf.loadLayersModel).not.toHaveBeenCalled();
    });

    it('passes an undefined requestLeave through', async () => {
      await subject.predictGestureAction(room, hands());
      expect(processGesture).toHaveBeenCalledWith(room, null, undefined);
    });
  });

  describe('single hand', () => {
    it('maps a confident left-hand gesture to its action', async () => {
      queuePredictions({ label: 'wave', score: 0.875 });

      await run(hands({ left: LEFT }));

      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);
    });

    it('maps a confident right-hand gesture to its action', async () => {
      queuePredictions({ label: 'thumbs_up', score: 0.875 });

      await run(hands({ right: RIGHT }));

      expect(processGesture).toHaveBeenCalledWith(
        room,
        'thumbs_up',
        requestLeave,
      );
    });

    it('accepts a score exactly at the single-hand threshold', async () => {
      queuePredictions({ label: 'wave', score: 0.5 });
      await run(hands({ left: LEFT }));
      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);
    });

    it('rejects a score just below the single-hand threshold', async () => {
      queuePredictions({ label: 'wave', score: 0.4375 });
      await run(hands({ left: LEFT }));
      expect(processGesture).toHaveBeenCalledWith(room, null, requestLeave);
    });

    it('picks the higher scoring hand when left is better', async () => {
      queuePredictions(
        { label: 'wave', score: 0.875 },
        { label: 'thumbs_up', score: 0.5625 },
      );
      await run(hands({ left: LEFT, right: RIGHT }));
      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);
    });

    it('picks the higher scoring hand when right is better', async () => {
      queuePredictions(
        { label: 'wave', score: 0.5625 },
        { label: 'thumbs_up', score: 0.875 },
      );
      await run(hands({ left: LEFT, right: RIGHT }));
      expect(processGesture).toHaveBeenCalledWith(
        room,
        'thumbs_up',
        requestLeave,
      );
    });
  });

  describe('label to action mapping', () => {
    it.each([
      ['a Gesture', 'wave'],
      ['a Reaction', 'heart'],
      ['a CaptionGesture', 'caption_a'],
    ])('maps %s labels to themselves', async (_kind, label) => {
      queuePredictions({ label, score: 0.875 });
      await run(hands({ left: LEFT }));
      expect(processGesture).toHaveBeenCalledWith(room, label, requestLeave);
    });

    it('returns a null action for a label that is not a known action', async () => {
      queuePredictions({ label: 'unmapped', score: 0.875 });
      await run(hands({ left: LEFT }));
      expect(processGesture).toHaveBeenCalledWith(room, null, requestLeave);
    });
  });

  describe('two-hand arbitration', () => {
    it('prefers a confident two-hand gesture over a single hand', async () => {
      queuePredictions(
        { label: 'wave', score: 0.5625 },
        { label: 'thumbs_up', score: 0.5 },
        { label: 'clap', score: 0.875 },
      );
      await run(hands({ left: LEFT, right: RIGHT, both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'clap', requestLeave);
    });

    it('still prefers two-hand when it is exactly within the preference margin', async () => {
      // 0.75 + 0.125 === 0.875
      queuePredictions(
        { label: 'wave', score: 0.875 },
        { label: 'clap', score: 0.75 },
      );
      await run(hands({ left: LEFT, both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'clap', requestLeave);
    });

    it('falls back to single hand when two-hand is outside the margin', async () => {
      queuePredictions(
        { label: 'wave', score: 0.9375 },
        { label: 'clap', score: 0.75 },
      );
      await run(hands({ left: LEFT, both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);
    });

    it('falls back to single hand when the two-hand score is below the multi-hand threshold', async () => {
      queuePredictions(
        { label: 'wave', score: 0.875 },
        { label: 'clap', score: 0.5 },
      );
      await run(hands({ left: LEFT, both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);
    });

    it('falls back to single hand when the two-hand label is not a two-hand gesture', async () => {
      queuePredictions(
        { label: 'thumbs_up', score: 0.5625 },
        { label: 'wave', score: 0.9375 },
      );
      await run(hands({ left: LEFT, both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(
        room,
        'thumbs_up',
        requestLeave,
      );
    });

    it('accepts a two-hand-only gesture that clears the multi-hand threshold', async () => {
      queuePredictions({ label: 'clap', score: 0.75 });
      await run(hands({ both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'clap', requestLeave);
    });

    it('rejects a two-hand-only gesture below the multi-hand threshold', async () => {
      queuePredictions({ label: 'clap', score: 0.5 });
      await run(hands({ both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, null, requestLeave);
    });

    it('uses the multi-hand threshold for a fallback both-hands candidate', async () => {
      // 'wave' is not a two-hand gesture, so it falls back, but the both-hands
      // candidate must still clear the stricter multi-hand threshold.
      queuePredictions({ label: 'wave', score: 0.875 });
      await run(hands({ both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, 'wave', requestLeave);

      processGesture.mockClear();
      queuePredictions({ label: 'wave', score: 0.5625 });
      await run(hands({ both: BOTH }));
      expect(processGesture).toHaveBeenCalledWith(room, null, requestLeave);
    });
  });

  describe('feature construction', () => {
    const lastInput = () => {
      const [rows, shape] = tf.tensor2d.mock.calls[0];
      return { input: rows[0] as number[], shape: shape as number[] };
    };
    const ones = (n: number) => Array(n).fill(1);
    const zeros = (n: number) => Array(n).fill(0);
    const tens = (n: number) => Array(n).fill(10);

    it('appends engineered features for a left-only hand', async () => {
      queuePredictions({ label: 'wave', score: 0.875 });
      await run(hands({ left: LEFT }));

      const { input, shape } = lastInput();
      expect(shape).toEqual([1, MODEL_INPUT_SIZE]);
      expect(input.slice(0, FEATURE_LEN)).toEqual(LEFT);
      expect(input.slice(FEATURE_LEN)).toEqual([
        ...ones(10), // left fingertip distances
        ...zeros(10), // missing right hand
        ...tens(26), // missing both-hands block
      ]);
      expect(utilities.getLandmarkCoordinatesFromFeatures).toHaveBeenCalledWith(
        LEFT.slice(0, VALUES_PER_HAND),
        8,
      );
    });

    it('uses only the right-hand half of the vector for a right-only hand', async () => {
      const right = [9, 9, 9, 9, 8, 8, 8, 8];
      queuePredictions({ label: 'wave', score: 0.875 });
      await run(hands({ right }));

      const { input } = lastInput();
      expect(input.slice(0, FEATURE_LEN)).toEqual(right);
      expect(input.slice(FEATURE_LEN)).toEqual([
        ...zeros(10), // missing left hand
        ...ones(10), // right fingertip distances
        ...tens(26),
      ]);
      expect(utilities.getLandmarkCoordinatesFromFeatures).toHaveBeenCalledWith(
        [8, 8, 8, 8],
        8,
      );
      expect(
        utilities.getLandmarkCoordinatesFromFeatures,
      ).not.toHaveBeenCalledWith(right, expect.anything());
    });

    it('adds palm and opposite-fingertip distances for both hands', async () => {
      queuePredictions({ label: 'clap', score: 0.875 });
      await run(hands({ both: BOTH }));

      const { input } = lastInput();
      expect(input.slice(0, FEATURE_LEN)).toEqual(BOTH);
      expect(input.slice(FEATURE_LEN)).toEqual([
        ...ones(10),
        ...ones(10),
        2, // palm distance
        ...ones(25), // 5 x 5 opposite fingertip distances
      ]);
      expect(utilities.calculatePalmDistance).toHaveBeenCalledWith(
        [1, 1, 1, 1],
        [2, 2, 2, 2],
      );
      // 10 (left) + 10 (right) + 25 (opposite)
      expect(utilities.calculateDistance3D).toHaveBeenCalledTimes(45);
    });
  });

  describe('model lifecycle', () => {
    it('loads the model from the public path once and reuses it', async () => {
      queuePredictions(
        { label: 'wave', score: 0.875 },
        { label: 'wave', score: 0.875 },
      );

      await run(hands({ left: LEFT }));
      await run(hands({ left: LEFT }));

      expect(tf.loadLayersModel).toHaveBeenCalledTimes(1);
      expect(tf.loadLayersModel).toHaveBeenCalledWith('/model/model.json');
      expect(model.predict).toHaveBeenCalledTimes(2);
    });

    it('disposes the input tensor and prediction tensor', async () => {
      queuePredictions({ label: 'wave', score: 0.875 });
      await run(hands({ left: LEFT }));

      const inputTensor = tf.tensor2d.mock.results[0].value;
      const predictionTensor = model.predict.mock.results[0].value;
      expect(inputTensor.dispose).toHaveBeenCalledTimes(1);
      expect(predictionTensor.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it.each([
      ['has no inputs', []],
      ['has no shape', [{}]],
      ['has a non-numeric width', [{ shape: [null, null] }]],
      ['has a non-finite width', [{ shape: [null, Infinity] }]],
    ])('rejects when the model %s', async (_name, inputs) => {
      model.inputs = inputs;

      await expect(run(hands({ left: LEFT }))).rejects.toThrow(
        'Gesture model input shape is invalid',
      );
      expect(processGesture).not.toHaveBeenCalled();
    });

    it('rejects when the input width does not match the model', async () => {
      model.inputs = [{ shape: [null, 10] }];

      await expect(run(hands({ left: LEFT }))).rejects.toThrow(
        `Gesture input width is invalid: ${MODEL_INPUT_SIZE} features vs 10 expected by model`,
      );
      expect(model.predict).not.toHaveBeenCalled();
      expect(processGesture).not.toHaveBeenCalled();
    });

    it('rejects and disposes the input when the model returns a non-tensor', async () => {
      model.predict.mockReturnValueOnce([1, 2, 3]);

      await expect(run(hands({ left: LEFT }))).rejects.toThrow(
        'Gesture model returned an unexpected output type',
      );
      expect(tf.tensor2d.mock.results[0].value.dispose).toHaveBeenCalledTimes(
        1,
      );
      expect(processGesture).not.toHaveBeenCalled();
    });

    it('rejects when the output size does not match the label count', async () => {
      const tensor = new tf.Tensor();
      tensor.data.mockResolvedValue(new Float32Array(3));
      model.predict.mockReturnValueOnce(tensor);

      await expect(run(hands({ left: LEFT }))).rejects.toThrow(
        `Model output size does not match gesture labels: 3 outputs vs ${LABELS.length} labels`,
      );
      expect(processGesture).not.toHaveBeenCalled();
    });

    it('rejects when the model fails to load', async () => {
      tf.loadLayersModel.mockRejectedValueOnce(new Error('network down'));

      await expect(run(hands({ left: LEFT }))).rejects.toThrow('network down');
      expect(processGesture).not.toHaveBeenCalled();
    });
  });
});
