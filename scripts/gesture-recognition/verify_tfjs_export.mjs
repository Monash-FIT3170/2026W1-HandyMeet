import fs from 'node:fs/promises';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';

const modelDir = process.argv[2];

if (!modelDir) {
  throw new Error('Expected model directory argument');
}

const modelJsonPath = path.join(modelDir, 'model.json');
const modelJson = JSON.parse(await fs.readFile(modelJsonPath, 'utf8'));
const manifest = modelJson.weightsManifest ?? [];
const shardBuffers = [];

for (const group of manifest) {
  for (const relativePath of group.paths ?? []) {
    shardBuffers.push(await fs.readFile(path.join(modelDir, relativePath)));
  }
}

const model = await tf.loadLayersModel({
  load: async () => ({
    modelTopology: modelJson.modelTopology,
    weightSpecs: manifest.flatMap((group) => group.weights ?? []),
    weightData: Buffer.concat(shardBuffers),
  }),
});

const inputShape = model.inputs[0]?.shape;
const inputWidth = inputShape?.[1];
if (typeof inputWidth !== 'number') {
  throw new Error(`Unexpected model input shape: ${JSON.stringify(inputShape)}`);
}

const outputTensor = model.predict(tf.zeros([1, inputWidth]));
if (!(outputTensor instanceof tf.Tensor)) {
  throw new Error('Model predict() returned a non-tensor output');
}

const outputData = await outputTensor.data();
const outputSum = Array.from(outputData).reduce((sum, value) => sum + value, 0);

console.log(
  JSON.stringify(
    {
      status: 'ok',
      inputShape,
      outputShape: model.outputs[0]?.shape,
      outputLength: outputData.length,
      outputSum: Number(outputSum.toFixed(6)),
    },
    null,
    2,
  ),
);

outputTensor.dispose();
model.dispose();
