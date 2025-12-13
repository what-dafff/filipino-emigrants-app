/**
 * Data Preparation Utilities for univariate time series
 */

/**
 * Clean and validate data, converting numeric fields; missing to 0
 */
export function cleanData(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => {
    const clean = { ...row };
    Object.keys(clean).forEach(k => {
      if (k === 'year') return;
      const v = Number(clean[k]);
      clean[k] = Number.isFinite(v) ? v : 0;
    });
    clean.year = String(row?.year ?? '').trim() || '';
    return clean;
  });
}

/**
 * Sort data chronologically by year (ascending)
 */
export function sortData(data) {
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => Number(a?.year || 0) - Number(b?.year || 0));
}

/**
 * Min-Max Normalization for provided features
 */
export function normalizeData(data, featureList = []) {
  const list = Array.isArray(featureList) && featureList.length ? featureList : [];
  const mins = {};
  const maxs = {};

  list.forEach(f => {
    const vals = (data || []).map(d => Number(d?.[f]) || 0);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    mins[f] = Number.isFinite(min) ? min : 0;
    maxs[f] = Number.isFinite(max) ? max : 1;
  });

  const normalized = (data || []).map(row => {
    const out = { year: row?.year };
    list.forEach(f => {
      const min = mins[f];
      const max = maxs[f];
      const denom = (max - min) || 1;
      out[f] = ((Number(row?.[f]) || 0) - min) / denom;
    });
    return out;
  });

  return { normalized, mins, maxs };
}

/**
 * Denormalize a value from [0,1] back to original
 */
export function denormalize(value, min, max) {
  const v = Number(value) || 0;
  return v * ((max - min) || 1) + min;
}

/**
 * Create sequences for supervised learning
 * features: array of 1 feature (univariate)
 * returns X: [samples, lookback, 1], y: [samples]
 */
export function createSequences(normalizedData, lookback, features, target) {
  const X = [];
  const y = [];
  const n = Array.isArray(normalizedData) ? normalizedData.length : 0;
  const flist = Array.isArray(features) ? features : [];

  if (!n || !flist.length || !lookback || !target) return { X, y };

  for (let i = lookback; i < n; i++) {
    const window = [];
    for (let t = i - lookback; t < i; t++) {
      const timestep = [];
      flist.forEach(f => {
        timestep.push(Number(normalizedData[t]?.[f]) || 0);
      });
      window.push(timestep);
    }
    X.push(window);
    y.push(Number(normalizedData[i]?.[target]) || 0);
  }

  return { X, y };
}

/**
 * Calculate metrics on original scale
 */
export function calculateMetrics(actual, predicted) {
  const n = Math.min(actual.length, predicted.length);
  const a = actual.slice(0, n).map(Number).filter(Number.isFinite);
  const p = predicted.slice(0, n).map(Number).filter(Number.isFinite);

  if (!a.length || !p.length) {
    return { accuracy: 0, mae: NaN, rmse: NaN, r2: NaN };
  }

  const errors = a.map((v, i) => p[i] - v);
  const absErrors = errors.map(e => Math.abs(e));
  const mae = absErrors.reduce((s, e) => s + e, 0) / a.length;
  const rmse = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / a.length);

  // R²
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const ssRes = errors.reduce((s, e) => s + e * e, 0);
  const ssTot = a.reduce((s, v) => s + Math.pow(v - meanA, 2), 0);
  const r2Raw = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const r2 = Number.isFinite(r2Raw) ? Math.max(0, Math.min(1, r2Raw)) : 0;

  // MAPE (guard division by zero): ignore terms where actual is 0
  const mapeTerms = a.map((v, i) => (v !== 0 ? Math.abs((p[i] - v) / v) : null)).filter(v => v != null);
  const mape = mapeTerms.length ? (mapeTerms.reduce((s, v) => s + v, 0) / mapeTerms.length) * 100 : NaN;
  const mapeCapped = Number.isFinite(mape) ? Math.min(100, Math.max(0, mape)) : 100;

  // Hybrid accuracy: 50% R² + 50% (1 − MAPE)
  const acc0to1 = 0.5 * r2 + 0.5 * (1 - mapeCapped / 100);
  const accuracyPct = Math.max(0, Math.min(100, acc0to1 * 100));

  return {
    accuracy: +accuracyPct.toFixed(2),
    mae: Number.isFinite(mae) ? +mae.toFixed(2) : NaN,
    rmse: Number.isFinite(rmse) ? +rmse.toFixed(2) : NaN,
    r2: Number.isFinite(r2Raw) ? +r2Raw.toFixed(4) : NaN,
  };
}