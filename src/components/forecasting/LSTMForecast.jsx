import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cleanData, sortData, normalizeData, denormalize, createSequences, calculateMetrics } from '../../utils/dataPrep';
import { buildLSTMModel, trainLSTMModel, predictLSTM, saveLSTMModel, loadLSTMModel, deleteLSTMModel, downloadLSTMModel } from '../../models/lstmModel';
import '../../forecastPanel.css';
import { ModelComparison } from '../../utils/modelComparison.js';


export default function LSTMForecast({ data }) {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [model, setModel] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [forecastYears, setForecastYears] = useState(5);
  const [forecasts, setForecasts] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [comparisonManager] = useState(() => new ModelComparison());
  const [modelComparison, setModelComparison] = useState([]);
  const [bestModel, setBestModel] = useState(null);


  const LOOKBACK = 3;
  const FEATURES = ['emigrants'];
  const TARGET = 'emigrants';

  const handleTrain = async () => {
    setIsTraining(true);
    setTrainingProgress({ epoch: 0, loss: 0, mae: 0 });
    setMetrics(null);

    try {
      let cleanedData = cleanData(data);
      cleanedData = sortData(cleanedData);

      const { normalized, mins, maxs } = normalizeData(cleanedData, FEATURES);
      const { X, y } = createSequences(normalized, LOOKBACK, FEATURES, TARGET);

      const newModel = buildLSTMModel(LOOKBACK, FEATURES.length, 50, 0.2);

      const onEpochEnd = (epoch, logs) => {
        setTrainingProgress({
          epoch: epoch + 1,
          loss: logs.loss.toFixed(6),
          mae: logs.mae.toFixed(6),
          val_loss: logs.val_loss?.toFixed(6),
          val_mae: logs.val_mae?.toFixed(6)
        });
      };

      await trainLSTMModel(newModel, X, y, onEpochEnd, 100, 0.2);

      const normalizedPredictions = await predictLSTM(newModel, X);

      const predictions = normalizedPredictions.map(pred =>
        denormalize(pred, mins[TARGET], maxs[TARGET])
      );

      const actualValues = y.map(val =>
        denormalize(val, mins[TARGET], maxs[TARGET])
      );

      // Create validation results table data (20% validation split for testing)
      const trainSize = Math.floor(actualValues.length * 0.8);
      const resultsData = actualValues.slice(trainSize).map((actual, index) => ({
        year: cleanedData[trainSize + index + LOOKBACK].year,
        actual: Math.round(actual),
        predicted: Math.round(predictions[trainSize + index]),
        error: Math.round(predictions[trainSize + index] - actual)
      }));
      setValidationResults(resultsData);

      const calculatedMetrics = calculateMetrics(actualValues, predictions);
      setMetrics(calculatedMetrics);

      const newMetadata = {
        modelType: 'LSTM',
        lookback: LOOKBACK,
        features: FEATURES,
        target: TARGET,
        units: 50,
        mins,
        maxs,
        lastYear: cleanedData[cleanedData.length - 1].year,
        lastData: cleanedData.slice(-LOOKBACK),
        metrics: calculatedMetrics,
        trainedAt: new Date().toISOString()
      };

      await saveLSTMModel(newModel, newMetadata);

      setModel(newModel);
      setMetadata(newMetadata);

      // Add this trained model to the comparison list
      comparisonManager.addModel({
        lookback: LOOKBACK,
        units: 50,
        dropout: 0.2,
        accuracy: Number(calculatedMetrics.accuracy),
        model: newModel,
        metadata: newMetadata
      });

      // update UI
      setModelComparison(comparisonManager.getAll());
      setBestModel(comparisonManager.getBest());

      alert(`LSTM model trained successfully!\nMAE: ${calculatedMetrics.mae}\nAccuracy: ${calculatedMetrics.accuracy}%`);
    } catch (error) {
      console.error('Training error:', error);
      alert('Error training model: ' + error.message);
    } finally {
      setIsTraining(false);
    }
  };

  // Tune across multiple configurations and compare accuracy
  const handleTuneModels = async () => {
    setIsTraining(true);
    setTrainingProgress({ epoch: 0, loss: 0, mae: 0 });
    setMetrics(null);

    try {
      let cleanedData = cleanData(data);
      cleanedData = sortData(cleanedData);

      const { normalized, mins, maxs } = normalizeData(cleanedData, FEATURES);

      // three configurations to evaluate (include epochs to try different training lengths)
      const tuneConfigs = [
        { lookback: 2, units: 32, dropout: 0.2, epochs: 25 },
        { lookback: 3, units: 50, dropout: 0.2, epochs: 50 },
        { lookback: 5, units: 64, dropout: 0.1, epochs: 100 }
      ];

      // Clear previous comparisons
      comparisonManager.clear();
      setModelComparison([]);
      setBestModel(null);

      // Train and evaluate each configuration
      for (const cfg of tuneConfigs) {
        const { X, y } = createSequences(normalized, cfg.lookback, FEATURES, TARGET);

        const modelCandidate = buildLSTMModel(cfg.lookback, FEATURES.length, cfg.units, cfg.dropout);

        const onEpochEnd = (epoch, logs) => {
          setTrainingProgress({
            epoch: epoch + 1,
            loss: logs.loss.toFixed(6),
            mae: logs.mae.toFixed(6),
            val_loss: logs.val_loss?.toFixed(6),
            val_mae: logs.val_mae?.toFixed(6),
            maxEpochs: cfg.epochs
          });
        };

        // Use cfg.epochs for tuning so we can try different training lengths
        await trainLSTMModel(modelCandidate, X, y, onEpochEnd, cfg.epochs, 0.2);

        const normalizedPredictions = await predictLSTM(modelCandidate, X);
        const predictions = normalizedPredictions.map(pred =>
          denormalize(pred, mins[TARGET], maxs[TARGET])
        );

        const actualValues = y.map(val =>
          denormalize(val, mins[TARGET], maxs[TARGET])
        );

        const calculatedMetrics = calculateMetrics(actualValues, predictions);
        
        const candidateMetadata = {
          modelType: 'LSTM',
          lookback: cfg.lookback,
          units: cfg.units,
          features: FEATURES,
          target: TARGET,
          mins,
          maxs,
          lastYear: cleanedData[cleanedData.length - 1].year,
          lastData: cleanedData.slice(-cfg.lookback),
          metrics: calculatedMetrics,
          trainedAt: new Date().toISOString()
        };

        // Add to comparison manager (use numeric accuracy for correct ordering)
        comparisonManager.addModel({
          lookback: cfg.lookback,
          units: cfg.units,
          dropout: cfg.dropout,
          accuracy: Number(calculatedMetrics.accuracy),
          model: modelCandidate,
          metadata: candidateMetadata
        });

        // update UI per run
        setModelComparison(comparisonManager.getAll());
        setBestModel(comparisonManager.getBest());
        // short pause to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Persist the best model so user can forecast using it
      const best = comparisonManager.getBest();
      if (best) {
        await saveLSTMModel(best.model, best.metadata);
        setModel(best.model);
        setMetadata(best.metadata);
        setMetrics(best.metadata.metrics);
      }

      alert('Tuning complete! Best model saved to IndexedDB.');
    } catch (error) {
      console.error('Tuning error:', error);
      alert('Error tuning models: ' + error.message);
    } finally {
      setIsTraining(false);
    }
  };

  // model comparison entries are added during training / tuning

  const handleLoadModel = async () => {
    try {
      const result = await loadLSTMModel();
      if (result) {
        setModel(result.model);
        setMetadata(result.metadata);
        setMetrics(result.metadata.metrics);
        alert('LSTM model loaded successfully!');
      } else {
        alert('No saved model found. Please train a model first.');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Error loading model: ' + error.message);
    }
  };

  const handleDeleteModel = async () => {
    if (!confirm('Are you sure you want to delete the saved LSTM model?')) return;

    try {
      await deleteLSTMModel();
      setModel(null);
      setMetadata(null);
      setMetrics(null);
      setForecasts([]);
      alert('LSTM model deleted successfully!');
    } catch (error) {
      console.error('Error deleting model:', error);
      alert('Error deleting model: ' + error.message);
    }
  };

  const handleDownloadModel = async () => {
    if (!model || !metadata) {
      alert('No model to download. Please train a model first.');
      return;
    }

    try {
      await downloadLSTMModel(model, metadata);
      alert('LSTM model files downloaded!');
    } catch (error) {
      console.error('Error downloading model:', error);
      alert('Error downloading model: ' + error.message);
    }
  };

  const handleForecast = async () => {
    if (!model || !metadata) {
      alert('Please train or load a model first.');
      return;
    }

    try {
      const { mins, maxs, lastData } = metadata;
      let currentSequence = lastData.map(row => ({
        year: row.year,
        emigrants: row.emigrants
      }));

      const predictions = [];
      let currentYear = metadata.lastYear;

      for (let i = 0; i < forecastYears; i++) {
        const normalized = currentSequence.map(row => ({
          emigrants: (row.emigrants - mins.emigrants) / (maxs.emigrants - mins.emigrants)
        }));

        const input = [normalized.map(row => FEATURES.map(f => row[f]))];
        const normalizedPred = await predictLSTM(model, input);
        const predictedEmigrants = denormalize(normalizedPred[0], mins[TARGET], maxs[TARGET]);

        currentYear++;
        predictions.push({
          year: currentYear.toString(),
          emigrants: Math.round(predictedEmigrants),
          isForecast: true
        });

        currentSequence = [
          ...currentSequence.slice(1),
          {
            year: currentYear,
            emigrants: predictedEmigrants
          }
        ];
      }

      setForecasts(predictions);
      alert(`Generated ${forecastYears} year LSTM forecast!`);
    } catch (error) {
      console.error('Forecasting error:', error);
      alert('Error generating forecast: ' + error.message);
    }
  };

  const chartData = [...data, ...forecasts];

  return (
    <div className="forecast-panel lstm-panel">
      <h2>LSTM Forecasting (Long Short-Term Memory)</h2>

      <div className="control-buttons">
        <button onClick={handleTrain} disabled={isTraining}>
          {isTraining ? 'Training...' : 'Train LSTM Model'}
        </button>
        <button onClick={handleTuneModels} disabled={isTraining}>
          {isTraining ? 'Tuning...' : 'Tune Models (3)'}
        </button>
        <button onClick={handleLoadModel} disabled={isTraining}>
          Load Model
        </button>
        <button onClick={handleDeleteModel} disabled={isTraining || !model}>
          Delete Model
        </button>
        <button onClick={handleDownloadModel} disabled={isTraining || !model}>
          Download Model
        </button>
      </div>

      {isTraining && trainingProgress && (
        <div className="training-progress">
          <h3>Training Progress</h3>
          <p>Epoch : {trainingProgress.epoch} / {trainingProgress.maxEpochs || 100}</p>
          <p>Loss : {trainingProgress.loss}</p>
          <p>MAE : {trainingProgress.mae}</p>
          {trainingProgress.val_loss && (
            <>
              <p>Val Loss : {trainingProgress.val_loss}</p>
              <p>Val MAE : {trainingProgress.val_mae}</p>
            </>
          )}
        </div>
      )}

      {metrics && !isTraining && (
        <>
          <div className="metrics">
            <h3>LSTM Model Performance Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">MAE :</span>
                <span className="metric-value">{metrics.mae}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">RMSE :</span>
                <span className="metric-value">{metrics.rmse}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">MAPE :</span>
                <span className="metric-value">{metrics.mape}%</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">R² :</span>
                <span className="metric-value">{metrics.r2}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Accuracy :</span>
                <span className="metric-value">{metrics.accuracy}%</span>
              </div>
            </div>
          </div>

          {validationResults.length > 0 && (
            <div className="training-results">
              <h3>Testing Results - 20% Split (Actual vs Predicted)</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Actual Emigrants</th>
                      <th>Predicted Emigrants</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResults.map((row, i) => (
                      <tr key={i}>
                        <td>{row.year}</td>
                        <td>{row.actual.toLocaleString()}</td>
                        <td>{row.predicted.toLocaleString()}</td>
                        <td className={row.error >= 0 ? 'error-positive' : 'error-negative'}>
                          {row.error >= 0 ? '+' : ''}{row.error.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modelComparison.length > 0 && (
        <div className="model-comparison">
            <h3>LSTM Model Comparison</h3>
            <table>
            <thead>
              <tr>
              <th>Model</th>
              <th>Lookback</th>
              <th>Units</th>
              <th>Dropout</th>
              <th>Accuracy (%)</th>
              </tr>
            </thead>
            <tbody>
              {bestModel && (
              <tr className="best-model-row best-model-top">
                <td>{bestModel.metadata?.modelType || 'LSTM'}</td>
                <td>{bestModel.lookback}</td>
                <td>{bestModel.units || bestModel.metadata?.units}</td>
                <td>{bestModel.dropout || bestModel.metadata?.dropout}</td>
                <td>{typeof bestModel.accuracy === 'number' ? bestModel.accuracy.toFixed(2) : bestModel.accuracy}</td>
              </tr>
              )}

              {modelComparison
                .filter(row => !(bestModel && row.timestamp === bestModel.timestamp))
                .map((row, i) => (
                <tr
                  key={row.timestamp || i}
                  className={bestModel === row ? "best-model-row" : ""}
                >
                  <td>{row.metadata?.modelType || 'LSTM'}</td>
                  <td>{row.lookback}</td>
                  <td>{row.units}</td>
                  <td>{row.dropout}</td>
                  <td>{typeof row.accuracy === 'number' ? row.accuracy.toFixed(2) : row.accuracy}</td>
                </tr>
              ))}
            </tbody>
            </table>

            {bestModel && (
              <div className="best-model-info">
                <h3>Best Performing LSTM Model</h3>
                <table className="best-model-table">
                  <tbody>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                    <tr>
                      <td>Accuracy</td>
                      <td>{bestModel.accuracy}%</td>
                    </tr>
                    <tr>
                      <td>Lookback</td>
                      <td>{bestModel.lookback}</td>
                    </tr>
                    <tr>
                      <td>Units</td>
                      <td>{bestModel.units}</td>
                    </tr>
                    <tr>
                      <td>Dropout</td>
                      <td>{bestModel.dropout}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

        </div>
        )}
        
      {model && !isTraining && (
        <div className="forecast-controls">
          <h3>Generate LSTM Forecast</h3>
          <div className="forecast-input">
            <label>
              Years to forecast:
              <input
                type="number"
                min="1"
                max="10"
                value={forecastYears}
                onChange={(e) => setForecastYears(parseInt(e.target.value))}
              />
            </label>
            <button onClick={handleForecast}>Generate Forecast</button>
          </div>
        </div>
      )}

      {forecasts.length > 0 && (
        <>
          <div className="chart-container">
            <h3>LSTM: Historical + Forecast</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis
                  label={{ value: 'Emigrants', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={(entry) => entry.isForecast ? null : entry.emigrants}
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="Emigrants (Historical)"
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.isForecast || !payload.emigrants) return null;
                    return <circle cx={cx} cy={cy} r={3} fill="#82ca9d" />;
                  }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey={(entry) => entry.isForecast ? entry.emigrants : null}
                  stroke="#ff6b6b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Emigrants (LSTM Forecast)"
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload.isForecast || !payload.emigrants) return null;
                    return <circle cx={cx} cy={cy} r={4} fill="#ff6b6b" />;
                  }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="forecast-results">
            <h3>LSTM Forecast Results ({selectedFeature})</h3>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Predicted {selectedFeature}</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f, i) => (
                  <tr key={i}>
                    <td>{f.year}</td>
                    <td>{Number(f[selectedFeature]).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}


      <div className="info-box">
        <h4>LSTM Model Configuration</h4>
        <ul>
          <li>Architecture: 2 LSTM layers (50 units each)</li>
          <li>Lookback window: {LOOKBACK} years</li>
          <li>Input features: Emigrants (historical values)</li>
          <li>Target: Emigrants (next year)</li>
          <li>Dropout: 0.2</li>
          <li>Epochs: 100 | Validation split: 20%</li>
        </ul>
      </div>
    </div>
  );
}
