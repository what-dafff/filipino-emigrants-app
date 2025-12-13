import * as tf from '@tensorflow/tfjs';

/**
 * Build univariate MLP model (single-input -> single-output)
 * inputShape: [lookback, features] then Flatten
 */
export function buildMLPModel(
  lookback = 3,
  features = 1,
  units1 = 64,
  units2 = 32,
  activation = 'relu',
  dropout = 0,
  learningRate = 0.001
) {
  const model = tf.sequential();

  model.add(tf.layers.inputLayer({ inputShape: [lookback, features] }));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: units1, activation }));
  if (dropout > 0) {
    model.add(tf.layers.dropout({ rate: dropout }));
  }
  model.add(tf.layers.dense({ units: units2, activation }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: ['mae']
  });

  return model;
}

/**
 * Train MLP model on 3D inputs [samples, lookback, 1]
 */
export async function trainMLPModel(model, X, y, onEpochEnd, epochs = 100, validationSplit = 0.2) {
  const samples = X?.length || 0;
  const lookback = samples ? (Array.isArray(X[0]) ? X[0].length : 0) : 0;

  const x3d = (Array.isArray(X) ? X : []).map(sample =>
    (Array.isArray(sample) ? sample : []).map(timestep =>
      Array.isArray(timestep) ? [Number(timestep[0]) || 0] : [Number(timestep) || 0]
    )
  );

  const xs = tf.tensor3d(x3d, [samples, lookback, 1]);
  const ys = tf.tensor2d((Array.isArray(y) ? y : []).map(v => Number(v) || 0), [y?.length || 0, 1]);

  const batchSize = Math.min(16, Math.max(4, samples));

  try {
    const history = await model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (onEpochEnd) onEpochEnd(epoch, logs);
        }
      },
      verbose: 0
    });
    return history;
  } finally {
    xs.dispose();
    ys.dispose();
  }
}

/**
 * Predict with MLP
 */
export async function predictMLP(model, X) {
  const samples = X?.length || 0;
  const lookback = samples ? (Array.isArray(X[0]) ? X[0].length : 0) : 0;

  const x3d = (Array.isArray(X) ? X : []).map(sample =>
    (Array.isArray(sample) ? sample : []).map(timestep =>
      Array.isArray(timestep) ? [Number(timestep[0]) || 0] : [Number(timestep) || 0]
    )
  );

  const xs = tf.tensor3d(x3d, [samples, lookback, 1]);

  let pred;
  try {
    const out = model.predict(xs);
    pred = Array.isArray(out) ? out[0] : out;
    const arr = await pred.array();
    return arr.map(row => row[0]);
  } finally {
    xs.dispose();
    pred?.dispose?.();
  }
}

/**
 * Save/Load/Delete/Download for MLP
 */
export async function saveMLPModel(model, metadata) {
  try {
    await model.save('indexeddb://emigrants-mlp-model');
    localStorage.setItem('mlp-metadata', JSON.stringify({
      ...(metadata || {}),
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    console.error('Error saving MLP model:', e);
    return false;
  }
}

export async function loadMLPModel() {
  try {
    const model = await tf.loadLayersModel('indexeddb://emigrants-mlp-model');
    const metadata = JSON.parse(localStorage.getItem('mlp-metadata') || '{}');
    return { model, metadata };
  } catch (e) {
    console.error('Error loading MLP model:', e);
    return null;
  }
}

export async function deleteMLPModel() {
  try {
    await tf.io.removeModel('indexeddb://emigrants-mlp-model');
    localStorage.removeItem('mlp-metadata');
    return true;
  } catch (e) {
    console.error('Error deleting MLP model:', e);
    return false;
  }
}

export async function downloadMLPModel(model, metadata) {
  await model.save('downloads://emigrants-mlp-model');
  const blob = new Blob([JSON.stringify(metadata ?? {}, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mlp-metadata.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
