import * as tf from '@tensorflow/tfjs';

/**
 * Build univariate LSTM model (single-input -> single-output)
 * inputShape: [lookback, features]
 */
export function buildLSTMModel(lookback = 3, features = 1, units = 50, dropout = 0.2, learningRate = 0.001) {
  const model = tf.sequential();

  model.add(tf.layers.lstm({
    units,
    inputShape: [lookback, features],
    dropout
  }));

  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: ['mae']
  });

  return model;
}

/**
 * Train LSTM model
 * X: [samples, lookback, 1], y: [samples]
 */
export async function trainLSTMModel(model, X, y, onEpochEnd, epochs = 100, validationSplit = 0.2) {
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
    // Keep model variables for predict/save
  }
}

/**
 * Predict with LSTM
 * X: [samples, lookback, 1]
 */
export async function predictLSTM(model, X) {
  const samples = X?.length || 0;
  const lookback = samples ? (Array.isArray(X[0]) ? X[0].length : 0) : 0;

  const x3d = (Array.isArray(X) ? X : []).map(sample =>
    (Array.isArray(sample) ? sample : []).map(timestep =>
      Array.isArray(timestep) ? [Number(timestep[0]) || 0] : [Number(timestep) || 0]
    )
  );

  const xs = tf.tensor3d(x3d, [samples, lookback, 1]);

  let predTensor;
  try {
    const out = model.predict(xs);
    predTensor = Array.isArray(out) ? out[0] : out;
    const arr = await predTensor.array();
    return arr.map(row => row[0]);
  } finally {
    xs.dispose();
    predTensor?.dispose?.();
  }
}

/**
 * Specific LSTM save/load/delete (legacy)
 */
export async function saveLSTMModel(model, metadata) {
  try {
    await model.save('indexeddb://emigrants-lstm-model');
    localStorage.setItem('lstm-metadata', JSON.stringify({ ...(metadata || {}), savedAt: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error('Error saving LSTM model:', e);
    return false;
  }
}
export async function loadLSTMModel() {
  try {
    const model = await tf.loadLayersModel('indexeddb://emigrants-lstm-model');
    const metadata = JSON.parse(localStorage.getItem('lstm-metadata') || '{}');
    return { model, metadata };
  } catch (e) {
    console.error('Error loading LSTM model:', e);
    return null;
  }
}
export async function deleteLSTMModel() {
  try {
    await tf.io.removeModel('indexeddb://emigrants-lstm-model');
    localStorage.removeItem('lstm-metadata');
    return true;
  } catch (e) {
    console.error('Error deleting LSTM model:', e);
    return false;
  }
}
export async function downloadLSTMModel(model, metadata) {
  await model.save('downloads://emigrants-lstm-model');
  const blob = new Blob([JSON.stringify(metadata ?? {}, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lstm-metadata.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generic save/load/delete keyed by dataset + feature
 * Used by ForecastPanel for both LSTM and MLP models
 */
const keyFor = (dataset, feature) => `timeseries-${dataset}-${feature}`;
const metaKeyFor = (dataset, feature) => `timeseries-meta:${dataset}:${feature}`;

export async function saveModel(model, metadata, dataset = 'civilStatus', feature = 'emigrants') {
  const key = keyFor(dataset, feature);
  const metaKey = metaKeyFor(dataset, feature);
  try {
    await model.save(`indexeddb://${key}`);
    localStorage.setItem(metaKey, JSON.stringify({ ...(metadata || {}), savedAt: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error('Error saving model:', e);
    return false;
  }
}

export async function loadModel(dataset = 'civilStatus', feature = 'emigrants') {
  const key = keyFor(dataset, feature);
  const metaKey = metaKeyFor(dataset, feature);
  try {
    const model = await tf.loadLayersModel(`indexeddb://${key}`);
    const metadata = JSON.parse(localStorage.getItem(metaKey) || '{}');
    return { model, metadata };
  } catch (e) {
    // No saved model
    return null;
  }
}

export async function deleteModel(dataset = 'civilStatus', feature = 'emigrants') {
  const key = keyFor(dataset, feature);
  const metaKey = metaKeyFor(dataset, feature);
  try {
    await tf.io.removeModel(`indexeddb://${key}`);
    localStorage.removeItem(metaKey);
    return true;
  } catch (e) {
    console.error('Error deleting model:', e);
    return false;
  }
}
