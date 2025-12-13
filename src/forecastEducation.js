import { loadLSTMModel } from "./models/lstmModel";
import { calculateVariance } from "./utils/dataPrep";
import * as tf from "@tensorflow/tfjs";

// Helper function for inverse scaling
function inverseScale(scaled, min, max) {
  const range = max - min || 1;
  return scaled.map(v => v * range + min);
}

export async function forecastAttribute(lastValues, attributeName, years = 5) {
  try {
    const loaded = await loadLSTMModel(`education-${attributeName}`);
    if (!loaded.success || !loaded.model) {
      console.error(`No model found for attribute: ${attributeName}`);
      return [];
    }

    const { model, metadata } = loaded;
    let { window_size, scaler_info } = metadata;
    
    // Get scaler for this attribute
    const targetScaler = scaler_info?.[attributeName];
    if (!targetScaler || !targetScaler.min || !targetScaler.max) {
      throw new Error(`Missing scaling information for ${attributeName}`);
    }
    
    const { min, max } = targetScaler;
    
    // Prepare seed sequence
    let seed = [...lastValues].slice(-window_size);
    while (seed.length < window_size) {
      seed.unshift(lastValues[0] || 0);
    }
    
    // Scale seed values
    const scaleDen = (max - min) || 1;
    const scale = (v) => (v - min) / scaleDen;
    const unscale = (v) => v * scaleDen + min;
    
    let normSeed = seed.map(scale);
    const predictions = [];

    for (let i = 0; i < years; i++) {
      // Create input tensor with correct shape [1, window_size, 1]
      const input = tf.tensor3d([normSeed.map(v => [v])]);
      
      try {
        const predTensor = model.predict(input);
        const predScaled = (await predTensor.data())[0];
        
        // Clean up tensors
        predTensor.dispose();
        input.dispose();
        
        // Unscale prediction
        const prediction = Math.max(0, unscale(predScaled));
        predictions.push(prediction);
        
        // Update seed for next prediction
        normSeed = [...normSeed.slice(1), predScaled];
      } catch (predError) {
        input.dispose();
        throw predError;
      }
    }

    return predictions;
  } catch (error) {
    console.error("Forecast error:", error);
    throw error;
  }
}

// Enhanced forecasting with confidence intervals
export async function forecastWithConfidence(lastValues, attributeName, years = 5, iterations = 100) {
  try {
    const pointForecast = await forecastAttribute(lastValues, attributeName, years);
    
    // Simple confidence calculation based on historical variance
    const variance = calculateVariance(lastValues);
    const confidenceInterval = pointForecast.map(pred => ({
      point: pred,
      lower: Math.max(0, pred - variance * 0.5),
      upper: pred + variance * 0.5,
      confidence: 0.95
    }));
    
    return confidenceInterval;
  } catch (error) {
    console.error("Confidence forecast error:", error);
    throw error;
  }
}

// Forecast multiple attributes
export async function forecastMultipleAttributes(data, attributes, years = 5) {
  const forecasts = {};
  const errors = [];
  
  for (const attribute of attributes) {
    try {
      const values = data.map(item => {
        const value = item[attribute];
        return typeof value === 'number' ? value : 0;
      }).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        const forecast = await forecastAttribute(values, attribute, years);
        forecasts[attribute] = {
          predictions: forecast,
          lastValue: values[values.length - 1] || 0,
          changePercent: forecast.length > 0 ? 
            ((forecast[0] - values[values.length - 1]) / values[values.length - 1] * 100) : 0
        };
      } else {
        errors.push(`${attribute}: No valid data`);
        forecasts[attribute] = { error: "No valid data" };
      }
    } catch (error) {
      console.error(`Error forecasting ${attribute}:`, error);
      errors.push(`${attribute}: ${error.message}`);
      forecasts[attribute] = { error: error.message };
    }
  }
  
  return {
    forecasts,
    errors,
    summary: {
      successful: Object.values(forecasts).filter(f => !f.error).length,
      failed: errors.length,
      total: attributes.length
    }
  };
}

// Calculate forecast trends
export function calculateForecastTrends(forecasts, historicalData) {
  const trends = {};
  
  Object.entries(forecasts).forEach(([attribute, data]) => {
    if (data.error || !data.predictions) return;
    
    const predictions = data.predictions;
    if (predictions.length < 2) return;
    
    const firstPred = predictions[0];
    const lastPred = predictions[predictions.length - 1];
    const historicalAvg = historicalData[attribute]?.reduce((a, b) => a + b, 0) / historicalData[attribute]?.length || 0;
    
    trends[attribute] = {
      growthRate: ((lastPred - firstPred) / firstPred) * 100,
      absoluteGrowth: lastPred - firstPred,
      historicalAvg,
      forecastAvg: predictions.reduce((a, b) => a + b, 0) / predictions.length,
      trend: lastPred > firstPred ? 'increasing' : lastPred < firstPred ? 'decreasing' : 'stable',
      confidence: Math.min(95, 100 - Math.abs(((lastPred - historicalAvg) / historicalAvg) * 10))
    };
  });
  
  return trends;
}
