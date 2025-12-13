// components/forecasting/ForecastPanel.jsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Download, Filter, TrendingUp, Zap, Database, AlertCircle, CheckCircle, BarChart3, Cpu } from 'lucide-react';
import { RefreshCcw } from 'lucide-react';
import '../../forecastPanel.css';
import * as tf from '@tensorflow/tfjs';

// Model imports
import { buildLSTMModel, trainLSTMModel, predictLSTM, saveModel, loadModel, deleteModel } from '../../models/lstmModel';
import { buildMLPModel, trainMLPModel, predictMLP } from '../../models/mlpModel';
import { ModelComparison } from '../../utils/modelComparison';
import { cleanData, normalizeData, createSequences, calculateMetrics, denormalize } from '../../utils/dataPrep';

export default function ForecastPanel({ data, datasetName, onRefresh }) {
  const [modelType, setModelType] = useState('LSTM');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [model, setModel] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [forecastYears, setForecastYears] = useState(5);
  const [forecasts, setForecasts] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [modelComparison, setModelComparison] = useState([]);
  const [bestModel, setBestModel] = useState(null);
  const [comparisonManager] = useState(() => new ModelComparison());
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState(null);
  const [dataStatus, setDataStatus] = useState('idle');
  const [bestModels, setBestModels] = useState({ lstm: null, mlp: null });

  // Load best models from localStorage
  useEffect(() => {
    const lstm = JSON.parse(localStorage.getItem('lstm-metadata'));
    const mlp = JSON.parse(localStorage.getItem('mlp-metadata'));
    setBestModels({ lstm, mlp });
  }, []);

  // Hyperparameter configurations for both LSTM and MLP (reduced to 3)
  const hyperparameterConfigs = [
    // LSTM
    { type: 'LSTM', lookback: 3, units: 32, dropout: 0.2, epochs: 100,  learningRate: 0.001 },
    // MLP
    { type: 'MLP',  lookback: 3, units1: 128, units2: 32, activation: 'relu',    dropout: 0.2, epochs: 100,  learningRate: 0.001 },
    // A slightly larger LSTM for comparison
    { type: 'LSTM', lookback: 3, units: 64, dropout: 0.2, epochs: 100, learningRate: 0.0005 },
  ];

  // Initialize when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      setDataStatus('loading');
      
      // Clean and prepare data
      const cleanedData = cleanData(data);
      setForecastData(cleanedData);
      
      // Extract all numeric features (excluding year)
      const firstItem = cleanedData[0] || {};
      const features = Object.keys(firstItem).filter(
        key => key !== 'year' && key !== 'id' && typeof firstItem[key] === 'number'
      );
      
      setAvailableFeatures(features);
      if (features.length > 0 && (!selectedFeature || !features.includes(selectedFeature))) {
        setSelectedFeature(features[0]);
      }
      
      setDataStatus('ready');
      setError(null);
    } else {
      setAvailableFeatures([]);
      setSelectedFeature('');
      setForecastData([]);
      setForecasts([]);
      setMetrics(null);
      setDataStatus('empty');

      // Clear best-performing models when data is deleted/empty
      try {
        localStorage.removeItem('lstm-metadata');
        localStorage.removeItem('mlp-metadata');
      } catch {}
      setBestModels({ lstm: null, mlp: null });
    }
  }, [data]);

  // generate forecast without retraining 
  const generateForecastPreview = async () => {
    if (!model || !metadata || !selectedFeature) return;
    try {
      const { mins, maxs, lastData } = metadata;
      let currentSequence = lastData.map(row => ({
        year: row.year,
        [selectedFeature]: row[selectedFeature]
      }));

      const predictions = [];
      let currentYear = Number(metadata.lastYear) || Number(currentSequence[currentSequence.length - 1]?.year) || 0;

      for (let i = 0; i < forecastYears; i++) {
        const denom = (maxs[selectedFeature] - mins[selectedFeature]) || 1;
        const normalized = currentSequence.map(row => ({
          [selectedFeature]: (row[selectedFeature] - mins[selectedFeature]) / denom
        }));
        const input = [normalized.map(row => [row[selectedFeature]])];

        const normalizedPred = metadata.modelType === 'LSTM'
          ? await predictLSTM(model, input)
          : await predictMLP(model, input);

        const predictedValue = denormalize(normalizedPred[0], mins[selectedFeature], maxs[selectedFeature]);

        currentYear++;
        predictions.push({
          year: currentYear.toString(),
          [selectedFeature]: Math.round(predictedValue),
          isForecast: true,
          modelType: metadata.modelType
        });

        currentSequence = [
          ...currentSequence.slice(1),
          { year: currentYear, [selectedFeature]: predictedValue }
        ];
      }

      setForecasts(predictions);
    } catch (err) {
      console.error('Preview forecast error:', err);
    }
  };

  const handleTrain = async () => {
    if (!forecastData || forecastData.length === 0) {
      alert('No civil status data available for training');
      return;
    }

    if (!selectedFeature) {
      alert('Please select a civil status feature to forecast');
      return;
    }

    if (forecastData.length < 10) {
      alert(`Need at least 10 years of data for training. Currently have ${forecastData.length} years.`);
      return;
    }

    setIsTraining(true);
    setTrainingProgress({ epoch: 0, loss: 0, mae: 0 });
    setMetrics(null);
    setError(null);
    setForecasts([]); 

    // Pause Firestore realtime updates
    pauseRealtime();

    try {
      const FEATURES = [selectedFeature];
      const TARGET = selectedFeature;
      const LOOKBACK = 3;

      const { normalized, mins, maxs } = normalizeData(forecastData, FEATURES);
      const { X, y } = createSequences(normalized, LOOKBACK, FEATURES, TARGET);

      if (X.length === 0 || y.length === 0) {
        throw new Error(`Not enough data to create sequences. Need at least ${LOOKBACK + 1} data points.`);
      }

      // Build model based on selected type
      let newModel;
      if (modelType === 'LSTM') {
        newModel = await buildLSTMModel(LOOKBACK, FEATURES.length, 64, 0.2, 0.001);
      } else {
        newModel = await buildMLPModel(LOOKBACK, FEATURES.length, 64, 32, 'relu', 0.2, 0.001);
      }

      const onEpochEnd = (epoch, logs) => {
        setTrainingProgress({
          epoch: epoch + 1,
          loss: logs.loss.toFixed(6),
          mae: logs.mae.toFixed(6),
          val_loss: logs.val_loss?.toFixed(6),
          val_mae: logs.val_mae?.toFixed(6)
        });
      };

      // Train model
      const trainFn = modelType === 'LSTM' ? trainLSTMModel : trainMLPModel;
      await trainFn(newModel, X, y, onEpochEnd, 100, 0.2);

      // Make predictions
      const predictFn = modelType === 'LSTM' ? predictLSTM : predictMLP;
      const normalizedPredictions = await predictFn(newModel, X);
      const predictions = normalizedPredictions.map(pred =>
        denormalize(pred, mins[TARGET], maxs[TARGET])
      );

      const actualValues = y.map(val =>
        denormalize(val, mins[TARGET], maxs[TARGET])
      );

      // Calculate metrics
      const calculatedMetrics = calculateMetrics(actualValues, predictions);
      setMetrics(calculatedMetrics);

      // Prepare validation results
      const trainSize = Math.floor(actualValues.length * 0.8);
      const resultsData = actualValues.slice(trainSize).map((actual, index) => ({
        year: forecastData[trainSize + index + LOOKBACK]?.year || `Year ${trainSize + index + LOOKBACK}`,
        actual: Math.round(actual),
        predicted: Math.round(predictions[trainSize + index]),
        error: Math.round(predictions[trainSize + index] - actual),
        errorPercent: actual !== 0 ? ((Math.abs(predictions[trainSize + index] - actual) / actual) * 100).toFixed(2) : '0.00'
      }));
      setValidationResults(resultsData);

      // Save model metadata
      const newMetadata = {
        modelType: modelType,
        lookback: LOOKBACK,
        features: FEATURES,
        target: TARGET,
        units: modelType === 'LSTM' ? 64 : '64/32',
        dropout: 0.2,
        activation: modelType === 'MLP' ? 'relu' : undefined,
        mins,
        maxs,
        lastYear: forecastData[forecastData.length - 1]?.year,
        lastData: forecastData.slice(-LOOKBACK),
        metrics: calculatedMetrics,
        trainedAt: new Date().toISOString(),
        dataset: 'civilStatus',
        feature: selectedFeature
      };

      await saveModel(newModel, newMetadata, 'civilStatus', selectedFeature);
      setModel(newModel);
      setMetadata(newMetadata);

      // Update best models
      if (modelType === 'LSTM') {
        localStorage.setItem('lstm-metadata', JSON.stringify(newMetadata));
      } else {
        localStorage.setItem('mlp-metadata', JSON.stringify(newMetadata));
      }
      setBestModels(prev => ({
        ...prev,
        [modelType.toLowerCase()]: newMetadata
      }));

      await generateForecastPreview();

      alert(`${modelType} model trained successfully!\nFeature: ${selectedFeature}\nAccuracy: ${calculatedMetrics.accuracy}%\nMAE: ${calculatedMetrics.mae}`);
    } catch (error) {
      console.error('Training error:', error);
      setError(error.message);
      alert('Error training model: ' + error.message);
    } finally {
      setIsTraining(false);
      resumeRealtime();
    }
  };

  const handleHyperparameterTuning = async () => {
    if (!forecastData || forecastData.length === 0) {
      alert('No civil status data available for training');
      return;
    }

    if (!selectedFeature) {
      alert('Please select a civil status feature to forecast');
      return;
    }

    if (forecastData.length < 15) {
      alert(`Need at least 15 years of data for hyperparameter tuning. Currently have ${forecastData.length} years.`);
      return;
    }

    setIsTraining(true);
    setTrainingProgress(null);
    setError(null);
    setForecasts([]); 
    // Pause Firestore realtime updates
    pauseRealtime();
    try {
      const FEATURES = [selectedFeature];
      const TARGET = selectedFeature;

      const { normalized, mins, maxs } = normalizeData(forecastData, FEATURES);

      // Test each configuration
      for (const [index, config] of hyperparameterConfigs.entries()) {
        try {
          if (config.lookback >= forecastData.length - 1) {
            console.warn(`Skipping config ${index}: lookback ${config.lookback} too large for ${forecastData.length} data points`);
            continue;
          }

          setTrainingProgress({
            epoch: 0,
            loss: 0,
            mae: 0,
            config: `${config.type} - Lookback: ${config.lookback}, Units: ${config.units || `${config.units1}/${config.units2}`}`,
            currentConfig: index + 1,
            totalConfigs: hyperparameterConfigs.length
          });

          const { X, y } = createSequences(normalized, config.lookback, FEATURES, TARGET);

          if (X.length === 0 || y.length === 0) {
            console.warn(`Not enough sequences for config ${index}`);
            continue;
          }

          let modelCandidate;
          if (config.type === 'LSTM') {
            modelCandidate = await buildLSTMModel(
              config.lookback,
              FEATURES.length,
              config.units,
              config.dropout,
              config.learningRate
            );
          } else {
            modelCandidate = await buildMLPModel(
              config.lookback,
              FEATURES.length,
              config.units1,
              config.units2,
              config.activation,
              config.dropout,
              config.learningRate
            );
          }

          const onEpochEnd = (epoch, logs) => {
            setTrainingProgress(prev => ({
              ...prev,
              epoch: epoch + 1,
              loss: logs.loss.toFixed(6),
              mae: logs.mae.toFixed(6),
              val_loss: logs.val_loss?.toFixed(6),
              val_mae: logs.val_mae?.toFixed(6),
              maxEpochs: config.epochs
            }));
          };

          const trainFn = config.type === 'LSTM' ? trainLSTMModel : trainMLPModel;
          await trainFn(modelCandidate, X, y, onEpochEnd, config.epochs, 0.2);

          // Evaluate model
          const predictFn = config.type === 'LSTM' ? predictLSTM : predictMLP;
          const normalizedPredictions = await predictFn(modelCandidate, X);
          const predictions = normalizedPredictions.map(pred =>
            denormalize(pred, mins[TARGET], maxs[TARGET])
          );

          const actualValues = y.map(val =>
            denormalize(val, mins[TARGET], maxs[TARGET])
          );

          const calculatedMetrics = calculateMetrics(actualValues, predictions);

          const candidateMetadata = {
            modelType: config.type,
            lookback: config.lookback,
            units: config.type === 'LSTM' ? config.units : `${config.units1}/${config.units2}`,
            dropout: config.dropout,
            activation: config.activation,
            learningRate: config.learningRate,
            features: FEATURES,
            target: TARGET,
            mins,
            maxs,
            lastYear: forecastData[forecastData.length - 1]?.year,
            lastData: forecastData.slice(-config.lookback),
            metrics: calculatedMetrics,
            trainedAt: new Date().toISOString(),
            dataset: 'civilStatus',
            feature: selectedFeature
          };

          comparisonManager.addModel({
            type: config.type,
            lookback: config.lookback,
            units: config.type === 'LSTM' ? config.units : `${config.units1}/${config.units2}`,
            dropout: config.dropout,
            activation: config.activation,
            accuracy: Number(calculatedMetrics.accuracy),
            mae: Number(calculatedMetrics.mae),
            rmse: Number(calculatedMetrics.rmse),
            model: modelCandidate,
            metadata: candidateMetadata,
            configId: `${config.type}_${config.lookback}_${config.units || config.units1}`
          });

          setModelComparison(comparisonManager.getAll());
          setBestModel(comparisonManager.getBest());

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error with config ${index}:`, error);
        }
      }

      // Save the best model
      const best = comparisonManager.getBest();
      if (best) {
        await saveModel(best.model, best.metadata, 'civilStatus', selectedFeature);
        setModel(best.model);
        setMetadata(best.metadata);
        setMetrics(best.metadata.metrics);
        
        // Update best model in localStorage
        if (best.type === 'LSTM') {
          localStorage.setItem('lstm-metadata', JSON.stringify(best.metadata));
        } else {
          localStorage.setItem('mlp-metadata', JSON.stringify(best.metadata));
        }
        setBestModels(prev => ({
          ...prev,
          [best.type.toLowerCase()]: best.metadata
        }));

        await generateForecastPreview();

        alert(`Hyperparameter tuning complete!\nBest Model: ${best.type} (Accuracy: ${best.accuracy.toFixed(2)}%)\nLookback: ${best.lookback} years`);
      } else {
        alert('No valid models were trained during tuning.');
      }
    } catch (error) {
      console.error('Tuning error:', error);
      setError(error.message);
      alert('Error during hyperparameter tuning: ' + error.message);
    } finally {
      setIsTraining(false);
      // Resume Firestore realtime updates
      resumeRealtime();
    }
  };

  const handleLoadModel = async () => {
    if (!selectedFeature) {
      alert('Please select a civil status feature first');
      return;
    }
    try {
      // Try app-saved model first
      const result = await loadModel('civilStatus', selectedFeature);
      if (result?.model) {
        setModel(result.model);
        setMetadata(result.metadata);
        setMetrics(result.metadata.metrics || null);
        setModelType(result.metadata.modelType || 'LSTM');
        alert=(`${result.metadata.modelType || 'Model'} loaded for feature: ${selectedFeature}`);
        return;
      }

      // Check if an uploaded model still exists in IndexedDB
      const idxKey = `indexeddb://civilStatus_${selectedFeature}`;
      const models = await tf.io.listModels().catch(() => ({}));
      const hasIndexed = !!models[idxKey];

      if (!hasIndexed) {
        alert(`No saved model found for ${selectedFeature}. Please train or upload TFJS model files.`);
        return;
      }

      // Load from IndexedDB
      const loaded = await tf.loadLayersModel(idxKey);
      const lstmMeta = (() => { try { return JSON.parse(localStorage.getItem('lstm-metadata')); } catch { return null; } })();
      const mlpMeta  = (() => { try { return JSON.parse(localStorage.getItem('mlp-metadata')); } catch { return null; } })();
      const metaLS = [lstmMeta, mlpMeta].find(m => m?.feature === selectedFeature) || lstmMeta || mlpMeta || {};

      setModel(loaded);
      setMetadata(metaLS);
      setMetrics(metaLS?.metrics || null);
      setModelType(metaLS?.modelType || 'LSTM');
      alert(`${metaLS?.modelType || 'Model'} loaded from IndexedDB for feature: ${selectedFeature}`);
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Error loading model: ' + error.message);
    }
  };

  const handleDeleteModel = async () => {
    if (!confirm(`Are you sure you want to delete the saved model for ${selectedFeature}?`)) return;
    if (!selectedFeature) {
      alert('Please select a feature');
      return;
    }
    try {
      // Delete your app-saved model (filesystem/localStorage/remote)
      await deleteModel('civilStatus', selectedFeature);

      // Also remove any TFJS uploaded model stored in IndexedDB
      const idxKey = `indexeddb://civilStatus_${selectedFeature}`;
      try { await tf.io.removeModel(idxKey); } catch {}

      // If you ever used localStorage://, remove that too
      const lsKey = `localstorage://civilStatus_${selectedFeature}`;
      try { await tf.io.removeModel(lsKey); } catch {}

      // Clear local state
      setModel(null);
      setMetadata(null);
      setMetrics(null);
      setForecasts([]);

      // Clear best-model metadata for this type
      const typeKey = (metadata?.modelType || modelType)?.toLowerCase();
      if (typeKey === 'lstm' || typeKey === 'mlp') {
        localStorage.removeItem(`${typeKey}-metadata`);
      }

      // Refresh Best Models Overview so deleted models no longer appear
      refreshBestModels();

      alert(`Model deleted for feature: ${selectedFeature}`);
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
      // Download TFJS model files (model.json + weights.bin)
      const baseName = `${metadata.modelType?.toLowerCase() || modelType.toLowerCase()}_civilStatus_${selectedFeature}`;
      await model.save(`downloads://${baseName}`);

      // Also download metadata JSON (optional, helpful context)
      const metaBlob = new Blob([JSON.stringify({ metadata, dataset: 'civilStatus', feature: selectedFeature }, null, 2)], { type: 'application/json' });
      const metaUrl = URL.createObjectURL(metaBlob);
      const a = document.createElement('a');
      a.href = metaUrl;
      a.download = `${baseName}_metadata.json`;
      a.click();
      URL.revokeObjectURL(metaUrl);

      alert('Model files downloaded (model.json + weights.bin). Use Upload to restore.');
    } catch (error) {
      console.error('Error downloading model:', error);
      alert('Error downloading model: ' + error.message);
    }
  };

  const handleUploadModel = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const modelJson = files.find(f => f.name.endsWith('.json') && !f.name.includes('metadata'));
      const weightsBins = files.filter(f => f.name.endsWith('.bin'));
      const metaJson = files.find(f => /metadata\.json$/i.test(f.name));

      if (modelJson && weightsBins.length > 0) {
        const model = await tf.loadLayersModel(tf.io.browserFiles([modelJson, ...weightsBins]));
        if (!selectedFeature) {
          alert('Please select a civil status feature before uploading a model.');
          event.target.value = '';
          return;
        }

        // If user provided a metadata.json, use it; else fall back to minimal
        let uploadedMetadata = {
          modelType: model.getConfig()?.layers?.some(l => l.class_name === 'LSTM') ? 'LSTM' : 'MLP',
          lookback: metadata?.lookback || 3,
          units: 'uploaded',
          dropout: metadata?.dropout,
          activation: metadata?.activation,
          features: [selectedFeature],
          target: selectedFeature,
          mins: metadata?.mins,
          maxs: metadata?.maxs,
          lastYear: forecastData[forecastData.length - 1]?.year,
          lastData: forecastData.slice(-(metadata?.lookback || 3)),
          metrics: null,
          trainedAt: new Date().toISOString(),
          dataset: 'civilStatus',
          feature: selectedFeature
        };

        if (metaJson) {
          const text = await metaJson.text();
          try {
            const parsed = JSON.parse(text);
            // Accept either {metadata: {...}} or plain metadata object
            const metaObj = parsed.metadata ?? parsed;
            // Only use metrics that exist
            uploadedMetadata = { ...uploadedMetadata, ...metaObj, metrics: metaObj.metrics ?? uploadedMetadata.metrics };
          } catch {
            console.warn('Invalid metadata.json; continuing with minimal metadata');
          }
        }

        // Save model to IndexedDB for this feature
        const storeKey = `indexeddb://civilStatus_${selectedFeature}`;
        await model.save(storeKey);

        // Persist metadata per type so Best Models Overview + Load can read metrics
        const typeKey = uploadedMetadata.modelType === 'LSTM' ? 'lstm-metadata' : 'mlp-metadata';
        localStorage.setItem(typeKey, JSON.stringify(uploadedMetadata));
        setBestModels(prev => ({ ...prev, [uploadedMetadata.modelType.toLowerCase()]: uploadedMetadata }));

        alert(`Model uploaded and saved.\nUse "Load Model" to activate it for ${selectedFeature}.`);
        event.target.value = '';
        return;
      }

      // Legacy single JSON
      if (files.length === 1 && files[0].name.endsWith('.json')) {
        const text = await files[0].text();
        try {
          const modelData = JSON.parse(text);
          if (modelData.dataset === 'civilStatus') {
            const meta = modelData.metadata ?? modelData;
            const typeKey = (meta?.modelType === 'MLP') ? 'mlp-metadata' : 'lstm-metadata';
            localStorage.setItem(typeKey, JSON.stringify(meta));
            setBestModels(prev => ({ ...prev, [typeKey.split('-')[0]]: meta }));
            alert('Metadata uploaded.\nNote: weights are not included, so Load Model will not work until TFJS files are uploaded.');
          } else {
            alert('This model file is not for civil status data.');
          }
        } catch (err) {
          console.error('Error parsing model file:', err);
          alert('Invalid model file format');
        } finally {
          event.target.value = '';
        }
        return;
      }

      alert('Select model.json + all weights .bin files (optionally add metadata.json).');
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading model:', error);
      alert('Error uploading model: ' + error.message);
      event.target.value = '';
    }
  };

  const handleForecast = async () => {
    // No retraining here; use pre-trained model only
    if (!model || !metadata) {
      alert('Please train or load a model first.');
      return;
    }
    try {
      await generateForecastPreview();
      alert(`Generated ${forecastYears}-year forecast for ${selectedFeature} using ${metadata.modelType}!`);
    } catch (error) {
      console.error('Forecasting error:', error);
      alert('Error generating forecast: ' + error.message);
    }
  };

  // Historical-only series
  const historicalSeries = (forecastData || [])
    .filter(d => d?.year && d[selectedFeature] != null)
    .map(d => ({
      year: String(d.year),
      value: Number(d[selectedFeature]) || 0
    }));

  // Forecast-only series
  const forecastSeries = (forecasts || [])
    .filter(d => d?.year && d[selectedFeature] != null)
    .map(d => ({
      year: String(d.year),
      value: Number(d[selectedFeature]) || 0
    }));

  // Combined overlay: show only when a forecast exists (after training/tuning triggers preview)
  const combinedSeries = [...forecastData.map(d => ({
    year: String(d.year),
    hist: d[selectedFeature] != null ? Number(d[selectedFeature]) : null,
    fc: null
  })), ...forecasts.map(d => ({
    year: String(d.year),
    hist: null,
    fc: d[selectedFeature] != null ? Number(d[selectedFeature]) : null
  }))].sort((a, b) => Number(a.year) - Number(b.year));

  // Refresh best models
  const refreshBestModels = () => {
    const lstm = (() => {
      try { return JSON.parse(localStorage.getItem('lstm-metadata')); } catch { return null; }
    })();
    const mlp = (() => {
      try { return JSON.parse(localStorage.getItem('mlp-metadata')); } catch { return null; }
    })();
    setBestModels({ lstm, mlp });
  };

  // Keep a ref to unsubscribe funcs for any Firestore onSnapshot you use elsewhere
  const [firestoreUnsubs, setFirestoreUnsubs] = useState([]);

  const pauseRealtime = () => {
    // Safely unsubscribe once
    firestoreUnsubs.forEach(fn => { try { fn && fn(); } catch {} });
    setFirestoreUnsubs([]);
  };

  const resumeRealtime = () => {
    // Re-subscribe your listeners and store unsub functions
    // Example:
    // const unsub = onSnapshot(docRef, (snap) => { /* ... */ });
    // setFirestoreUnsubs(prev => [...prev, unsub]);
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleRefreshData = async () => {
    try {
      setDataStatus('loading');
      setError(null);

      // Re-clean and prepare current data (no page reload)
      const cleanedData = cleanData(data || []);
      setForecastData(cleanedData);

      const firstItem = cleanedData[0] || {};
      const features = Object.keys(firstItem).filter(
        key => key !== 'year' && key !== 'id' && typeof firstItem[key] === 'number'
      );
      setAvailableFeatures(features);
      if (features.length > 0 && (!selectedFeature || !features.includes(selectedFeature))) {
        setSelectedFeature(features[0]);
      }

      // Clear transient UI state
      setForecasts([]);
      setValidationResults([]);
      setMetrics(null);
      setModelComparison([]);
      setBestModel(null);

      // If after refresh the dataset is empty, also clear best models
      if (cleanedData.length === 0) {
        try {
          localStorage.removeItem('lstm-metadata');
          localStorage.removeItem('mlp-metadata');
        } catch {}
        setBestModels({ lstm: null, mlp: null });
      }

      // Optionally ask parent to re-fetch data from source (API/Firestore)
      if (typeof onRefresh === 'function') {
        await onRefresh();
      }

      // Re-read best models from localStorage
      refreshBestModels();

      setDataStatus('ready');
    } catch (err) {
      console.error('Refresh error:', err);
      setError(err.message || 'Unable to refresh');
      setDataStatus('ready');
    }
  };

  return (
    <div className="forecast-panel">
      {/* Header */}
      <div className="forecast-header">
        <div className="header-left">
          <TrendingUp size={24} />
          <div>
            <h2>Civil Status Forecasting</h2>
            <p className="dataset-info">
              Model: <strong>{modelType}</strong> • 
              Feature: <strong>{selectedFeature || 'Select a feature'}</strong> • 
              Records: <strong>{forecastData.length}</strong> years
            </p>
          </div>
        </div>
        {/* Refresh button */}
        <button className="btn-refresh" onClick={handleRefreshData} title="Refresh">
          <RefreshCcw size={18} />
          { /*<span>Refresh</span>*/ }
        </button>
      </div>

      {/* Data Status */}
      {dataStatus === 'empty' ? (
        <div className="no-data-message">
          <Database size={48} />
          <h3>No Civil Status Data Available</h3>
          <p>Please upload civil status data through the Civil Status page first.</p>
          <p>Navigate to: Civil Status → Import CSV</p>
        </div>
      ) : dataStatus === 'ready' && forecastData.length > 0 ? (
        <div className="data-ready-message">
          <CheckCircle size={20} />
          <span>
            Civil Status data ready: {forecastData.length} years ({forecastData[0]?.year} - {forecastData[forecastData.length - 1]?.year})
          </span>
          <span className="feature-count">
            {availableFeatures.length} features available
          </span>
        </div>
      ) : null}

      {/* Error Display */}
      {error && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {selectedFeature && (
        <div className="forecast-charts-stack">
          <div className="chart-wrapper chart-historical">
            <h3>Historical ({selectedFeature})</h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={historicalSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Historical"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

        <div className="feature-selector">
          <label>Civil Status Feature:</label>
          <select
            value={selectedFeature}
            onChange={(e) => setSelectedFeature(e.target.value)}
            disabled={isTraining || availableFeatures.length === 0}
          >
            <option value="">Select civil status</option>
            {availableFeatures.map(feature => (
              <option key={feature} value={feature}>
                {feature.charAt(0).toUpperCase() + feature.slice(1)}
              </option>
            ))}
          </select>
        </div>

      {/* Model Selector */}
      <div className="model-selector">
        <h3>Select Model Type</h3>
        <div className="model-options">
          <label className={`model-option ${modelType === 'LSTM' ? 'active' : ''}`}>
            <input
              type="radio"
              value="LSTM"
              checked={modelType === 'LSTM'}
              onChange={(e) => setModelType(e.target.value)}
              disabled={isTraining}
            />
            <Cpu size={20} />
            <span>LSTM (Long Short-Term Memory)</span>
          </label>
          
          <label className={`model-option ${modelType === 'MLP' ? 'active' : ''}`}>
            <input
              type="radio"
              value="MLP"
              checked={modelType === 'MLP'}
              onChange={(e) => setModelType(e.target.value)}
              disabled={isTraining}
            />
            <BarChart3 size={20} />
            <span>MLP (Multi-Layer Perceptron)</span>
          </label>
        </div>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-group">
          <button
            onClick={handleTrain}
            disabled={isTraining || !selectedFeature || forecastData.length < 10}
            className="btn-primary"
          >
            <Zap size={18} />
            Train {modelType} Model
          </button>
          <button
            onClick={handleHyperparameterTuning}
            disabled={isTraining || !selectedFeature || forecastData.length < 15}
            className="btn-secondary"
          >
            <Filter size={18} />
            Tune {modelType} Model
          </button>
          
          <button onClick={handleLoadModel} disabled={isTraining || !selectedFeature} 
            className="btn-load">
            Load Model 
          </button>
          <label className="btn-upload">
            <Upload size={18} />
            Upload Model
            <input
              type="file"
              accept=".json,.bin"
              multiple
              onChange={handleUploadModel}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleDeleteModel} disabled={isTraining || !model} 
          className="btn-delete">
            Delete Model
          </button>
          <button onClick={handleDownloadModel} disabled={isTraining || !model} 
          className="btn-secondary">
            <Download size={18} />
            Download Model
          </button>
        </div>
      </div>

      {/* Training Progress */}
      {isTraining && trainingProgress && (
        <div className="training-progress">
          <div className="progress-header">
            <h3>Training Progress</h3>
            <span>
              Config {trainingProgress.currentConfig || 1}/{trainingProgress.totalConfigs || 1}
            </span>
          </div>
          {trainingProgress.config && (
            <div className="config-info">{trainingProgress.config}</div>
          )}
          <div className="progress-grid">
            <div className="progress-item">
              <span>Epoch: </span>
              <strong>{trainingProgress.epoch}/{trainingProgress.maxEpochs || 100}</strong>
            </div>
            <div className="progress-item">
              <span>Loss: </span>
              <strong>{trainingProgress.loss}</strong>
            </div>
            <div className="progress-item">
              <span>MAE: </span>
              <strong>{trainingProgress.mae}</strong>
            </div>
            {trainingProgress.val_loss && (
              <>
                <div className="progress-item">
                  <span>Val Loss: </span>
                  <strong>{trainingProgress.val_loss}</strong>
                </div>
                <div className="progress-item">
                  <span>Val MAE: </span>
                  <strong>{trainingProgress.val_mae}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Metrics Display */}
      {metrics && !isTraining && (
        <div className="metrics-display">
          <h3>{modelType} Model Performance for {selectedFeature}</h3>
          <div className="metrics-grid">
            <div className="metric-card accuracy">
              <span className="metric-label">Accuracy</span>
              <span className="metric-value">{metrics.accuracy}%</span>
            </div>
            <div className="metric-card mae">
              <span className="metric-label">MAE</span>
              <span className="metric-value">{metrics.mae}</span>
            </div>
            <div className="metric-card rmse">
              <span className="metric-label">RMSE</span>
              <span className="metric-value">{metrics.rmse}</span>
            </div>
            <div className="metric-card r2">
              <span className="metric-label">R² Score</span>
              <span className="metric-value">{metrics.r2}</span>
            </div>
          </div>
        </div>
      )}

      {/* Model Comparison Table */}
      {modelComparison.length > 0 && (
        <div className="model-comparison">
          <h3>Model Comparison for {selectedFeature}</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  <th>Lookback</th>
                  <th>Units</th>
                  <th>Activation / Dropout</th>
                  <th>Accuracy (%)</th>
                  <th>MAE</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison
                  .sort((a, b) => b.accuracy - a.accuracy)
                  .map((model, index) => (
                    <tr
                      key={model.configId}
                      className={index === 0 ? 'best-model' : ''}
                    >
                      <td>{index + 1}</td>
                      <td>{model.type}</td>
                      <td>{model.lookback} years</td>
                      <td>{model.units}</td>
                      <td>
                        {model.type === 'MLP' 
                          ? (model.activation || 'relu') 
                          : (model.dropout ? `Dropout: ${model.dropout}` : 'N/A')
                        }
                      </td>
                      <td className="accuracy-cell">
                        {model.accuracy.toFixed(2)}%
                      </td>
                      <td>{model.mae?.toFixed(2) || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${index === 0 ? 'best' : 'other'}`}>
                          {index === 0 ? 'BEST' : 'Tested'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best Model Info */}
      {bestModel && (
        <div className="best-model-info">
          <h3>Selected Best Model for {selectedFeature}</h3>
          <div className="best-model-details">
            <div className="detail-item">
              <span>Model Type: </span>
              <strong>{bestModel.type}</strong>
            </div>
            <div className="detail-item">
              <span>Lookback: </span>
              <strong>{bestModel.lookback} years</strong>
            </div>
            <div className="detail-item">
              <span>Units: </span>
              <strong>{bestModel.units}</strong>
            </div>
            <div className="detail-item">
              <span>Accuracy: </span>
              <strong className="highlight">{bestModel.accuracy.toFixed(2)}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Best Models Overview */}
      {model && (bestModels.lstm || bestModels.mlp) && (
        <div className="best-models-overview">
          <div className="overview-header">
            <h3>Best Performing Models</h3>
            <button onClick={refreshBestModels} className="btn-refresh">
              Refresh
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Feature</th>
                  <th>Lookback</th>
                  <th>Units</th>
                  <th>Activation / Dropout</th>
                  <th>Accuracy (%)</th>
                  <th>MAE</th>
                </tr>
              </thead>
              <tbody>
                {bestModels.lstm && (
                  <tr className="lstm-model">
                    <td>LSTM</td>
                    {/* New Feature cell */}
                    <td>{bestModels.lstm.feature || selectedFeature || '—'}</td>
                    <td>{bestModels.lstm.lookback}</td>
                    <td>{bestModels.lstm.units}</td>
                    <td>{bestModels.lstm.dropout ? `Dropout: ${bestModels.lstm.dropout}` : 'N/A'}</td>
                    <td className="accuracy-cell">
                      {bestModels.lstm.metrics?.accuracy || 'N/A'}
                    </td>
                    <td>{bestModels.lstm.metrics?.mae || 'N/A'}</td>
                  </tr>
                )}
                {bestModels.mlp && (
                  <tr className="mlp-model">
                    <td>MLP</td>
                    {/* New Feature cell */}
                    <td>{bestModels.mlp.feature || selectedFeature || '—'}</td>
                    <td>{bestModels.mlp.lookback}</td>
                    <td>{bestModels.mlp.units}</td>
                    <td>
                      {bestModels.mlp.activation ? `${bestModels.mlp.activation}` : 'N/A'}
                      {bestModels.mlp.dropout ? `, Dropout: ${bestModels.mlp.dropout}` : ''}
                    </td>
                    <td className="accuracy-cell">
                      {bestModels.mlp.metrics?.accuracy || 'N/A'}
                    </td>
                    <td>{bestModels.mlp.metrics?.mae || 'N/A'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forecast Controls */}
      {model && !isTraining && forecastData.length > 0 && (
        <div className="forecast-controls">
          <h3>Generate Forecast using {metadata?.modelType || modelType}</h3>
          <div className="forecast-inputs">
            <div className="input-group">
              <label>Years to Forecast (1-10):</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={forecastYears}
                  onChange={(e) => setForecastYears(parseInt(e.target.value))}
                  className="forecast-slider"
                />
                <span className="slider-value">{forecastYears} years</span>
              </div>
            </div>
            <button onClick={handleForecast} className="btn-forecast">
              Generate {forecastYears}-Year Forecast
            </button>
          </div>
        </div>
      )}

      {/* Charts: historical on top, combined below. Combined only visible after forecast is available */}
      {selectedFeature && (
        <div className="forecast-charts-stack">
          {/* Combined (Historical + Forecast) appears only after forecasts are generated */}
          {forecastSeries.length > 0 && (
            <div className="chart-wrapper chart-combined">
              <h3>Combined (Historical + Forecast)</h3>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={combinedSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="hist"
                    name="Historical"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fc"
                    name="Forecast"
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Forecast Results Table */}
      {forecasts.length > 0 && (
        <div className="forecast-results">
          <h3>Forecast Results for {selectedFeature}</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Predicted {selectedFeature}</th>
                  <th>Change from Previous</th>
                  <th>Annual Growth Rate</th>
                  <th>Model Used</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((forecast, index) => {
                  const previousValue = index === 0
                    ? forecastData[forecastData.length - 1][selectedFeature] || 0
                    : forecasts[index - 1][selectedFeature];
                  const change = forecast[selectedFeature] - previousValue;
                  const growthRate = previousValue !== 0
                    ? ((change / previousValue) * 100).toFixed(2)
                    : '0.00';

                  return (
                    <tr key={forecast.year}>
                      <td>{forecast.year}</td>
                      <td>{forecast[selectedFeature].toLocaleString()}</td>
                      <td className={change >= 0 ? 'positive' : 'negative'}>
                        {change >= 0 ? '+' : ''}{change.toLocaleString()}
                      </td>
                      <td className={change >= 0 ? 'positive' : 'negative'}>
                        {growthRate}%
                      </td>
                      <td className="model-type">
                        {forecast.modelType || metadata?.modelType || modelType}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <div className="validation-results">
          <h3>Model Validation for {selectedFeature} (20% Test Set)</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Actual</th>
                  <th>Predicted</th>
                  <th>Error</th>
                  <th>Error %</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map((result, index) => (
                  <tr key={index}>
                    <td>{result.year}</td>
                    <td>{result.actual.toLocaleString()}</td>
                    <td>{result.predicted.toLocaleString()}</td>
                    <td className={result.error >= 0 ? 'positive' : 'negative'}>
                      {result.error >= 0 ? '+' : ''}{result.error.toLocaleString()}
                    </td>
                    <td>{result.errorPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}