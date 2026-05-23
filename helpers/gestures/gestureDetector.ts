import * as tf from '@tensorflow/tfjs';
import type { Room } from 'livekit-client';
import { Gesture } from '@/constants/gestures';
import { Reaction } from '@/constants/reactions';
import gestureLabels from '@/scripts/gesture-recognition/model_labels.json';
import type { Action } from './handler';
import { processGesture } from '../filtering/gesture-filter';

export type GestureModelInput = Float32Array;
export type GestureModelOutput = Float32Array;
export type GesturePrediction = {
  label: string;
  score: number;
  index: number;
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
  input: GestureModelInput,
): Promise<void> => {
  const prediction = await predictGesture(input);
  const action = mapPredictedGestureToAction(prediction);

  if (action) await processGesture(room, action);
};
