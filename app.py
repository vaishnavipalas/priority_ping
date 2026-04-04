from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np

app = Flask(__name__)
CORS(app)

# Load model
try:
    model = joblib.load("model.pkl")
except:
    model = None
    print("Model not found. Please run train_model.py first.")

def get_reasons(row, prob):
    reasons = []
    
    # Feature mapping for human-readable reasons
    if row['days_until_deadline'] <= 1:
        reasons.append("Deadline is very soon")
    if row['is_graded'] == 1:
        reasons.append("This is a graded task")
    if row['requires_submission'] == 1:
        reasons.append("Requires submission or attendance")
    if row['title_has_urgent_keyword'] == 1:
        reasons.append("Title contains urgency language")
    if row['has_time_reference'] == 1:
        reasons.append("Title references a specific time")
    if row['estimated_time_hours'] >= 2:
        reasons.append("High estimated time commitment")
    if row['teacher_posted'] == 1:
        reasons.append("Posted by instructor")
        
    return reasons

@app.route('/predict_one', methods=['POST'])
def predict_one():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = request.json
    df_input = pd.DataFrame([data])
    
    # Predict
    prob = model.predict_proba(df_input)[0][1]
    urgent = int(prob >= 0.5)
    
    reasons = get_reasons(data, prob)
    
    return jsonify({
        "urgent": urgent,
        "confidence": float(prob),
        "reasons": reasons
    })

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data_list = request.json
    df_input = pd.DataFrame(data_list)
    
    # Predict
    probs = model.predict_proba(df_input)[:, 1]
    
    results = []
    for i, prob in enumerate(probs):
        row = data_list[i]
        urgent = int(prob >= 0.5)
        reasons = get_reasons(row, prob)
        
        results.append({
            **row,
            "urgent": urgent,
            "confidence": float(prob),
            "reasons": reasons
        })
    
    # Sort by confidence descending
    results.sort(key=lambda x: x["confidence"], reverse=True)
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
