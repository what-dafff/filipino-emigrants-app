import { minMaxScale, makeWindows, calculateMetrics, cleanDataArray } from "./utils/dataPrep";
import { buildLSTMModel, trainLSTMModel, saveLSTMModel, predictLSTM } from "./models/lstmModel";

// Helper function for inverse scaling
function inverseScale(scaled, min, max) {
  const range = max - min || 1;
  return scaled.map(v => v * range + min);
}

export async function trainEducationAttribute(series, attributeName, windowSize = 3, onProgress = null) {
  if (!series || series.length === 0) {
    throw new Error("No data provided for training");
  }
  
  // Clean and validate data
  const cleanSeries = cleanDataArray(series);
  if (cleanSeries.length < windowSize * 2) {
    throw new Error(`Need at least ${windowSize * 2} data points for window size ${windowSize}`);
  }
  
  // Prepare univariate training data
  const { scaled, min, max } = minMaxScale(cleanSeries);
  const [X, y] = makeWindows(scaled, windowSize);
  
  if (X.length === 0 || y.length === 0) {
    throw new Error("Insufficient data for the specified window size");
  }
  
  console.log(`Training univariate LSTM for ${attributeName} with ${X.length} samples`);
  
  // Reshape X for LSTM: [samples, timesteps, features]
  // For univariate: features = 1
  const X_3d = X.map(window => window.map(value => [value]));
  
  // Build univariate LSTM model
  const model = buildLSTMModel(windowSize, 1, 50, 0.2);
  
  // Train model with progress callback
  const history = await trainLSTMModel(
    model, 
    X_3d, 
    y, 
    200, 
    0.2,
    onProgress
  );
  
  // Make predictions to calculate metrics
  const predictions = await predictLSTM(model, X_3d);
  const actualValues = inverseScale(y, min, max);
  const predictedValues = inverseScale(predictions, min, max);
  
  const metrics = calculateMetrics(actualValues, predictedValues);
  
  // Create comprehensive metadata for univariate model
  const metadata = {
    window_size: windowSize,
    scaler_info: {
      [attributeName]: { min, max }
    },
    framework: "tfjs",
    targetKey: attributeName,
    predictors: [], // Empty for univariate
    target: attributeName,
    training_date: new Date().toISOString(),
    samples: X_3d.length,
    epochs_trained: 200,
    validation_split: 0.2,
    metrics: metrics,
    last_values: cleanSeries.slice(-windowSize),
    model_type: "univariate_lstm",
    architecture: "2-layer LSTM",
    units: 50,
    dropout: 0.2,
    data_stats: {
      min: Math.min(...cleanSeries),
      max: Math.max(...cleanSeries),
      mean: cleanSeries.reduce((a, b) => a + b, 0) / cleanSeries.length,
      std: Math.sqrt(
        cleanSeries.reduce((sq, n) => sq + Math.pow(n - (cleanSeries.reduce((a, b) => a + b, 0) / cleanSeries.length), 2), 0) / 
        cleanSeries.length
      ),
      data_points: cleanSeries.length
    }
  };
  
  // Save model
  await saveLSTMModel(model, metadata, `education-${attributeName}`);
  
  console.log("Training completed and model saved!");
  console.log("Metrics:", metrics);
  
  return {
    model,
    metadata,
    history,
    metrics
  };
}

// Batch train multiple attributes with univariate approach
export async function batchTrainEducation(data, attributes, windowSize = 3, onProgress = null) {
  const results = {};
  const total = attributes.length;
  let completed = 0;
  
  for (const attribute of attributes) {
    try {
      const series = data.map(item => {
        const value = item[attribute];
        return typeof value === 'number' ? value : 0;
      });
      
      // Check if we have enough data
      const validPoints = series.filter(v => v > 0).length;
      if (validPoints >= windowSize * 2) {
        console.log(`Training ${attribute} (${completed + 1}/${total})...`);
        
        if (onProgress) {
          onProgress(completed + 1, total, `Training ${attribute}...`);
        }
        
        const result = await trainEducationAttribute(series, attribute, windowSize);
        results[attribute] = result;
      } else {
        console.log(`Skipping ${attribute} - insufficient data (${validPoints} valid points)`);
        results[attribute] = { error: `Insufficient data: ${validPoints} valid points` };
      }
    } catch (error) {
      console.error(`Error training ${attribute}:`, error);
      results[attribute] = { error: error.message };
    }
    
    completed++;
    
    if (onProgress && completed < total) {
      onProgress(completed, total, `Completed ${completed}/${total} attributes`);
    }
  }
  
  // Summary
  const trainedCount = Object.values(results).filter(r => !r.error).length;
  console.log(`Batch training completed: ${trainedCount}/${total} attributes trained successfully`);
  
  return {
    results,
    summary: {
      total: total,
      successful: trainedCount,
      failed: total - trainedCount,
      attributes: attributes
    }
  };
}