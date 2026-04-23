/**
 * Logistic Regression Inference Engine for PriorityPing
 */
class CanvasClassifier {
  constructor(weights) {
    this.intercept = weights.intercept; // [n_classes]
    this.coef = weights.coef; // [n_classes, n_features]
    this.classes = weights.classes;
    this.featureNames = weights.feature_names;
    this.featureMeans = weights.feature_means;
    this.featureStds = weights.feature_stds;
    this.typeCategories = weights.notification_type_categories;
    this.typeBaseline = this.typeCategories[0];
  }

  softmax(scores) {
    const maxScore = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(es => es / sumExp);
  }

  normalize(features) {
    const normalized = {};
    for (const name of this.featureNames) {
      const val = features[name] || 0;
      const mean = this.featureMeans[name] || 0;
      const std = this.featureStds[name] || 1;
      normalized[name] = (val - mean) / (std || 1);
      
      if (isNaN(normalized[name]) || !isFinite(normalized[name])) {
        normalized[name] = 0;
      }
    }
    return normalized;
  }

  encodeType(type) {
    const encoded = {};
    // Skip baseline (index 0)
    for (let i = 1; i < this.typeCategories.length; i++) {
        const catName = `notification_type_${this.typeCategories[i]}`;
        encoded[catName] = (type === this.typeCategories[i]) ? 1 : 0;
    }
    return encoded;
  }

  buildFeatureObject(notification) {
    const defaults = {
      has_deadline: 0,
      days_until_deadline: -1,
      is_graded: 0,
      requires_submission: 0,
      teacher_posted: 0,
      estimated_time_hours: 1.0,
      title_has_urgent_kw: 0,
      has_time_reference: 0,
      course_credits: 9
    };

    const typeEncoding = this.encodeType(notification.notification_type || this.typeBaseline);
    return { ...defaults, ...notification, ...typeEncoding };
  }

  predict(notification) {
    try {
      const features = this.buildFeatureObject(notification);
      const normalized = this.normalize(features);
      
      // Vectorize
      const x = this.featureNames.map(name => normalized[name]);
      
      // Compute dot products + intercept for each class
      // z_k = sum(w_ki * x_i) + b_k
      const scores = this.classes.map((c, k) => {
          let dot = 0;
          for (let i = 0; i < x.length; i++) {
              dot += this.coef[k][i] * x[i];
          }
          return dot + this.intercept[k];
      });

      const probs = this.softmax(scores);
      const maxProb = Math.max(...probs);
      const priority = this.classes[probs.indexOf(maxProb)];
      
      const labels = ['low', 'moderate', 'high', 'critical'];
      
      return {
        priority: priority,
        confidence: maxProb,
        label: labels[priority],
        uncertain: maxProb < 0.6
      };
    } catch (err) {
      console.error('Classification error:', err);
      return { priority: 1, confidence: 0, label: 'moderate', uncertain: true };
    }
  }

  explain(notification) {
    const features = this.buildFeatureObject(notification);
    const normalized = this.normalize(features);
    const result = this.predict(notification);
    const k = this.classes.indexOf(result.priority);
    
    if (k === -1) return [];

    const contributions = this.featureNames.map((name, i) => {
        const val = normalized[name];
        const weight = this.coef[k][i];
        const contrib = weight * val;
        return {
            feature: name,
            value: features[name],
            magnitude: Math.abs(contrib),
            direction: contrib > 0 ? 'increased' : 'decreased'
        };
    });

    return contributions
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 3);
  }
}

window.CanvasClassifier = CanvasClassifier;
