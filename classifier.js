/**
 * PriorityPing Classifier Engine
 * Logistic Regression with Human-AI Explainability (G1, G2, G11)
 */
class CanvasClassifier {
  constructor(weights) {
    this.actionWeights = weights.action_weights;
    this.infoWeights = weights.info_weights;
  }

  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  predict(features) {
    const config = features.bucket === 'action' ? this.actionWeights : this.infoWeights;
    let z = config.bias;

    for (const [feature, weight] of Object.entries(config.weights)) {
      const val = features[feature] || 0;
      // Adjust course_importance (1-3) to be centered at 2 (mid)
      const adjustedVal = (feature === 'course_importance') ? (val - 2) : val;
      z += weight * adjustedVal;
    }

    const score = this.sigmoid(z);

    let label = "Low";
    if (score >= 0.7) label = "Urgent";
    else if (score >= 0.4) label = "Moderate";

    // Confidence = certainty about the assigned label, scaled to 40–100%
    let rawConfidence;
    if (label === "Urgent") rawConfidence = (score - 0.7) / 0.3;
    else if (label === "Low") rawConfidence = (0.4 - score) / 0.4;
    else rawConfidence = 1 - Math.abs(score - 0.55) / 0.15;
    const confidence = Math.round(40 + rawConfidence * 60);

    return { score, confidence, label };
  }

  explain(features) {
    const config = features.bucket === 'action' ? this.actionWeights : this.infoWeights;
    const pred = this.predict(features);
    
    const contributions = [];
    let suppressed_reason = null;

    for (const [feature, weight] of Object.entries(config.weights)) {
      const val = features[feature] || 0;
      const adjustedVal = (feature === 'course_importance') ? (val - 2) : val;
      const contrib = weight * adjustedVal;

      if (Math.abs(contrib) > 0.1) {
        contributions.push({
          feature,
          val: adjustedVal,
          contrib,
          label: config.descriptions[feature]
        });
      }
    }

    // Sort by absolute contribution descending
    contributions.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

    // Detection for suppression (G11)
    if (pred.score < 0.4) {
      const negativeCourse = contributions.find(c => c.feature === 'course_importance' && c.contrib < 0);
      if (negativeCourse) suppressed_reason = "This is a low-priority class.";
      else if (features.requires_action === 0) suppressed_reason = "No action is required from you.";
      else suppressed_reason = "This appears to be a routine system notification.";
    }

    const bullets = contributions
      .filter(c => c.contrib > 0.2) // Only show positive contributors for "Why"
      .slice(0, 6)
      .map(c => c.label);

    return {
      score: pred.score,
      confidence: pred.confidence,
      priority_label: pred.label,
      bucket: features.bucket,
      headline: features.title,
      bullets: bullets.length > 0 ? bullets : ["Routine update detected."],
      suppressed_reason: suppressed_reason
    };
  }
}

window.CanvasClassifier = CanvasClassifier;
