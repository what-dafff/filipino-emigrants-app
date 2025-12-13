export class ModelComparison {
  constructor() {
    this.models = [];
    this.bestModel = null;
  }

  /**
   * Add a model result
   * @param {Object} params
   * @param {'LSTM'|'MLP'|string} [params.type] 
   * @param {number} params.lookback
   * @param {number} [params.units]
   * @param {number} [params.dropout]
   * @param {number|string} [params.accuracy] 
   * @param {number|string} [params.mae]
   * @param {number|string} [params.rmse]
   * @param {number|string} [params.r2]
   * @param {*} [params.model]
   * @param {Object} [params.metadata] 
   */
  addModel({ type, lookback, units, dropout, accuracy, mae, rmse, r2, model, metadata }) {
    const metaMetrics = metadata?.metrics || {};
    const safeNum = (v) => {
      const n = typeof v === 'string' ? Number(v.replace(/[, ]/g, '')) : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // Numeric-only fields
    const rawAccuracy = safeNum(accuracy ?? metaMetrics.accuracy);
    const rawMae = safeNum(mae ?? metaMetrics.mae);
    const rawRmse = safeNum(rmse ?? metaMetrics.rmse);
    const rawR2 = safeNum(r2 ?? metaMetrics.r2);

    let normalizedAccuracy = null;
    if (rawAccuracy != null) {
      if (rawAccuracy <= 1 && rawAccuracy >= 0) normalizedAccuracy = +(rawAccuracy * 100).toFixed(2);
      else if (rawAccuracy <= 100 && rawAccuracy >= 0) normalizedAccuracy = +rawAccuracy.toFixed(2);
    }

    const entry = {
      type: type || metadata?.modelType || 'Unknown',
      lookback: safeNum(lookback) ?? null,
      // IMPORTANT: keep units as provided; MLP may be "64/32"
      units: units ?? metadata?.units ?? null,
      dropout: safeNum(dropout) ?? (metadata?.dropout ?? null),
      accuracy: normalizedAccuracy ?? 0,
      mae: rawMae,
      rmse: rawRmse,
      r2: rawR2,
      model,
      metadata,
      timestamp: new Date().toISOString(),
      configId: metadata?.configId || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    };

    this.models.push(entry);
    this.models.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
    this.bestModel = this.models[0] || null;
    return entry;
  }

  getAll() { return [...this.models]; }
  getBest() { return this.bestModel; }
  clear() { this.models = []; this.bestModel = null; }
}
