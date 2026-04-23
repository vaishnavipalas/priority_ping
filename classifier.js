/**
 * Logistic Regression Engine for PriorityPing
 * Dual-Bucket Implementation (Action vs Info)
 */
class CanvasClassifier {
  constructor(weights) {
    this.weights = weights;
  }

  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  predict(features) {
    const bucket = features.bucket;
    const config = this.weights[bucket];
    if (!config) return { score: 0, label: 'Low' };

    let z = config.bias;
    for (const [feature, weight] of Object.entries(config.weights)) {
      const val = features[feature] || 0;
      // Note: course_importance is 1-3, we treat 2 as baseline (z+=0)
      const adjustedVal = (feature === 'course_importance') ? (val - 2) : val;
      z += weight * adjustedVal;
    }

    const score = this.sigmoid(z);
    let label = "Low";
    if (score >= 0.7) label = "High";
    else if (score >= 0.4) label = "Medium";

    return { score, label };
  }

  explain(features) {
    const bucket = features.bucket;
    const config = this.weights[bucket];
    const prediction = this.predict(features);
    
    const factors = [];
    let suppressed_by = null;

    for (const [feature, weight] of Object.entries(config.weights)) {
      const val = features[feature] || 0;
      const adjustedVal = (feature === 'course_importance') ? (val - 2) : val;
      const contribution = weight * adjustedVal;

      if (Math.abs(contribution) > 0.3) {
        factors.push({
          feature,
          label: config.labels[feature] || feature,
          impact: Math.abs(contribution) > 1.5 ? 'high' : 'medium',
          direction: contribution > 0 ? 'up' : 'down',
          contribution
        });
      }
    }

    factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    // Detection for "suppressed_by" (e.g. urgent keyword in a low-importance class)
    const lowImportance = factors.find(f => f.feature === 'course_importance' && f.direction === 'down');
    if (lowImportance && prediction.score < 0.7) {
      suppressed_by = "Low-priority course settings";
    }

    return {
      score: prediction.score,
      priority_label: prediction.label,
      bucket: bucket,
      headline: this.generateHeadline(features, factors, prediction.label),
      factors: factors.slice(0, 3).map(f => ({
          feature: f.feature,
          label: f.label,
          impact: f.impact,
          direction: f.direction
      })),
      suppressed_by: suppressed_by
    };
  }

  generateHeadline(features, factors, label) {
    const topFactor = factors[0];
    if (features.bucket === 'action') {
      if (label === 'High' || label === 'Critical') {
        if (features.notification_type === 5) return "Action required: Missing assignment in a priority class";
        if (features.title_has_urgent_kw) return "Urgent deadline detected in your activity";
        return "Action required: Impending academic task";
      }
    } else {
      if (label === 'High') return "Important announcement you should see";
    }
    return `${label} priority notification`;
  }
}

window.CanvasClassifier = CanvasClassifier;
