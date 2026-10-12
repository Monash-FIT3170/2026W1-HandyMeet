// Original schematics from labelled training landmarks; no video or photo assets.
// Run from repository root: node scripts/help/generate-gesture-reference.mjs
import fs from 'node:fs/promises';
import * as tf from '@tensorflow/tfjs';

const base = 'scripts/gesture-recognition';
const labels = JSON.parse(
  await fs.readFile(`${base}/model_labels.json`, 'utf8'),
);
const lines = (
  await fs.readFile(
    `${base}/training_data/02_training_data/03_training_data.csv`,
    'utf8',
  )
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const groups = new Map();
for (const line of lines) {
  const [label, ...values] = line.split(',');
  if (['help', 'pen'].includes(label)) continue; // No implemented meeting action.
  if (!groups.has(label)) groups.set(label, []);
  groups.get(label).push(values.map(Number));
}
const spec = JSON.parse(await fs.readFile('public/model/model.json', 'utf8'));
const buffers = [];
for (const group of spec.weightsManifest) {
  for (const shard of group.paths)
    buffers.push(await fs.readFile(`public/model/${shard}`));
}
const model = await tf.loadLayersModel({
  load: async () => ({
    modelTopology: spec.modelTopology,
    weightSpecs: spec.weightsManifest.flatMap((group) => group.weights),
    weightData: Buffer.concat(buffers),
  }),
});
const fingerNames = [
  'thumb',
  'index finger',
  'middle finger',
  'ring finger',
  'little finger',
];
const chains = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
function describe(hand) {
  return chains
    .map((chain, i) => {
      const [a, b, , c] = chain.map((index) => hand[index]);
      const u = a.map((v, j) => v - b[j]);
      const v = c.map((x, j) => x - b[j]);
      const cosine =
        u.reduce((s, x, j) => s + x * v[j], 0) /
        (Math.hypot(...u) * Math.hypot(...v));
      const angle =
        (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
      return `${fingerNames[i]} ${angle > 150 ? 'mostly straight' : angle < 100 ? 'curled' : 'bent'}`;
    })
    .join('; ');
}
const result = {};
for (const [label, allRows] of groups) {
  const rows = allRows
    .filter((_, i) => i % Math.max(1, Math.floor(allRows.length / 40)) === 0)
    .slice(0, 40);
  const input = tf.tensor2d(rows);
  const output = model.predict(input);
  const scores = await output.array();
  const valid = rows
    .map((row, i) => ({ row, i, score: scores[i][labels.indexOf(label)] }))
    .filter(
      ({ i, score }) =>
        score >= 0.9 &&
        scores[i].indexOf(Math.max(...scores[i])) === labels.indexOf(label),
    );
  if (!valid.length)
    throw new Error(`No correctly classified reference for ${label}`);
  const centre = rows[0].map(
    (_, j) => rows.reduce((s, row) => s + row[j], 0) / rows.length,
  );
  const distance = (row) =>
    row.slice(0, 126).reduce((s, x, j) => s + (x - centre[j]) ** 2, 0);
  valid.sort((a, b) => distance(a.row) - distance(b.row));
  const sample = valid[0];
  const hands = [0, 63]
    .filter((start) =>
      sample.row.slice(start, start + 63).some((value) => value !== 0),
    )
    .map((start) =>
      Array.from({ length: 21 }, (_, i) =>
        sample.row.slice(start + i * 3, start + i * 3 + 3),
      ),
    );
  const points = hands.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const scale = Math.min(
    220 / (Math.max(...xs) - minX),
    170 / (Math.max(...ys) - minY),
  );
  const offsetX = (260 - (Math.max(...xs) - minX) * scale) / 2;
  const offsetY = (210 - (Math.max(...ys) - minY) * scale) / 2;
  result[label] = {
    hands: hands.map((hand) =>
      hand.map(([x, y]) => [
        Number((offsetX + (x - minX) * scale).toFixed(2)),
        Number((offsetY + (y - minY) * scale).toFixed(2)),
      ]),
    ),
    instructions: hands.map(
      (hand, i) =>
        `${hands.length === 1 ? 'One hand' : `Hand ${i + 1}`}: ${describe(hand)}.`,
    ),
    modelScore: Number(sample.score.toFixed(6)),
  };
  input.dispose();
  output.dispose();
}
model.dispose();
await fs.writeFile(
  'constants/gestureReference.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  `Created ${Object.keys(result).length} original gesture references; all samples classified correctly at >= 90% confidence.`,
);
