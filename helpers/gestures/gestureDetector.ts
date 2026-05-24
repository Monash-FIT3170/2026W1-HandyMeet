import * as tf from '@tensorflow/tfjs';
import type { Room } from 'livekit-client';
import {
  Gesture,
  MULTI_HAND_CONFIDENCE_THRESHOLD,
  SINGLE_HAND_CONFIDENCE_THRESHOLD,
} from '@/constants/gestures';
import { Reaction } from '@/constants/reactions';
import gestureLabels from '@/scripts/gesture-recognition/model_labels.json';
import {
  HAND_FEATURE_VECTOR_LENGTH,
  type HandFeatureVectors,
} from './handLandmarkFeatures';
import type { Action } from './handler';
import { processGesture } from '../filtering/gesture-filter';

export type GestureModelInput = Float32Array;
export type GestureModelOutput = Float32Array;
export type GesturePrediction = {
  label: string;
  score: number;
  index: number;
};
type GesturePredictionCandidate = {
  candidateName: 'left-only' | 'right-only' | 'both-hands';
  prediction: GesturePrediction;
};

let gestureModelPromise: Promise<tf.LayersModel> | null = null;
const gestureValues = new Set<string>(Object.values(Gesture));
const reactionValues = new Set<string>(Object.values(Reaction));

const loadGestureModel = (): Promise<tf.LayersModel> => {
  if (!gestureModelPromise) {
    gestureModelPromise = tf.loadLayersModel('/model/model.json');
  }

  return gestureModelPromise;
};

const getGestureLabels = (): readonly string[] => gestureLabels;

const getExpectedInputSize = (model: tf.LayersModel): number => {
  const inputShape = model.inputs[0]?.shape;
  const size = inputShape?.[1];

  if (typeof size !== 'number' || !Number.isFinite(size)) {
    throw new Error('Gesture model input shape is invalid');
  }

  return size;
};

const mapGestureScoresToLabels = (
  scores: ArrayLike<number>,
): GesturePrediction[] => {
  const labels = getGestureLabels();

  if (scores.length !== labels.length) {
    throw new Error(
      `Model output size does not match gesture labels: ${scores.length} outputs vs ${labels.length} labels`,
    );
  }

  return labels.map((label, index) => ({
    label,
    score: scores[index] ?? 0,
    index,
  }));
};

const getBestGesturePrediction = (
  scores: ArrayLike<number>,
): GesturePrediction => {
  const predictions = mapGestureScoresToLabels(scores);

  return predictions.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
};

const mapPredictedGestureToAction = (
  prediction: GesturePrediction,
): Action | null => {
  if (gestureValues.has(prediction.label)) {
    return prediction.label as Gesture;
  }

  if (reactionValues.has(prediction.label)) {
    return prediction.label as Reaction;
  }

  return null;
};

const predictGesture = async (
  input: GestureModelInput,
): Promise<GesturePrediction> => {
  const model = await loadGestureModel();
  const expectedInputSize = getExpectedInputSize(model);

  if (expectedInputSize !== HAND_FEATURE_VECTOR_LENGTH) {
    throw new Error(
      `Gesture feature width does not match model input: ${HAND_FEATURE_VECTOR_LENGTH} features vs ${expectedInputSize} expected by model`,
    );
  }

  if (input.length !== expectedInputSize) {
    throw new Error(
      `Gesture input width is invalid: ${input.length} features vs ${expectedInputSize} expected by model`,
    );
  }

  const inputTensor = tf.tensor2d([Array.from(input)], [1, input.length]);
  const prediction = model.predict(inputTensor);

  if (!(prediction instanceof tf.Tensor)) {
    inputTensor.dispose();
    throw new Error('Gesture model returned an unexpected output type');
  }

  const output = Float32Array.from(await prediction.data());
  prediction.dispose();
  inputTensor.dispose();

  return getBestGesturePrediction(output);
};

export const predictGestureAction = async (
  room: Room,
  featureVectors: HandFeatureVectors,
  disconnect?: () => void,
): Promise<void> => {
  const candidates: GesturePredictionCandidate[] = [];

  if (featureVectors.left) {
    candidates.push({
      candidateName: 'left-only',
      prediction: await predictGesture(Float32Array.from(featureVectors.left)),
    });
  }

  if (featureVectors.right) {
    candidates.push({
      candidateName: 'right-only',
      prediction: await predictGesture(Float32Array.from(featureVectors.right)),
    });
  }

  if (featureVectors.both) {
    candidates.push({
      candidateName: 'both-hands',
      prediction: await predictGesture(Float32Array.from(featureVectors.both)),
    });
  }

  if (candidates.length === 0) {
    await processGesture(room, null, disconnect);
    return;
  }

  const twoHandCandidate = candidates.find(
    (candidate) => candidate.candidateName === 'both-hands',
  );

  const chosenCandidate =
    twoHandCandidate &&
    twoHandCandidate.prediction.score >= MULTI_HAND_CONFIDENCE_THRESHOLD
      ? twoHandCandidate
      : candidates.reduce((best, current) =>
          current.prediction.score > best.prediction.score ? current : best,
        );

  const acceptanceThreshold =
    chosenCandidate.candidateName === 'both-hands'
      ? MULTI_HAND_CONFIDENCE_THRESHOLD
      : SINGLE_HAND_CONFIDENCE_THRESHOLD;

  const action =
    chosenCandidate.prediction.score >= acceptanceThreshold
      ? mapPredictedGestureToAction(chosenCandidate.prediction)
      : null;

  await processGesture(room, action, disconnect);
};
