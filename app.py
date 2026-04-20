from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# Load model
try:
    model = joblib.load("model.pkl")
except:
    model = None
    print("Model not found. Please run train_model.py first.")

def _has_deadline(row):
    if "has_deadline" in row and row["has_deadline"] is not None:
        try:
            return int(row["has_deadline"]) == 1
        except (TypeError, ValueError):
            pass
    t = row.get("notification_type")
    return t in ("assignment_due", "quiz_due")


def normalize_row_for_model(row):
    """Ensure training features are present; infer has_deadline from type if omitted."""
    r = dict(row)
    if r.get("has_deadline") is None:
        r["has_deadline"] = int(r.get("notification_type") in ("assignment_due", "quiz_due"))
    return r


def get_reasons(row, prob):
    reasons = []

    has_deadline = _has_deadline(row)
    days_until_deadline = row.get("days_until_deadline", 99)
    requires_submission = int(row.get("requires_submission", 0))
    is_graded = int(row.get("is_graded", 0))
    notif_type = row.get("notification_type", "")
    title_has_urgent_keyword = int(row.get("title_has_urgent_keyword", 0))
    has_time_reference = int(row.get("has_time_reference", 0))
    estimated_time_hours = float(row.get("estimated_time_hours", 0))
    teacher_posted = int(row.get("teacher_posted", 0))

    deadline_near = has_deadline and days_until_deadline <= 2
    strong_urgency_signal = (requires_submission == 1 and deadline_near) or (
        title_has_urgent_keyword == 1 and has_time_reference == 1
    )

    # Informational types are usually low action unless strong urgency signals exist.
    if notif_type in ("announcement", "event") and not strong_urgency_signal:
        reasons.append("Informational update: no immediate action is needed.")

    if requires_submission == 1 and deadline_near:
        day_label = "day" if days_until_deadline == 1 else "days"
        reasons.append(
            f"Action required soon: submission is due in {days_until_deadline} {day_label}."
        )
    elif requires_submission == 1:
        reasons.append("Action required: this needs submission or attendance.")

    if is_graded == 1 and requires_submission == 0:
        reasons.append("This affects your grade, but no action is required right now.")
    elif is_graded == 1:
        reasons.append("This can affect your grade.")

    if title_has_urgent_keyword == 1:
        reasons.append("The title uses urgency language.")
    if has_time_reference == 1:
        reasons.append("The title mentions a specific time.")
    if estimated_time_hours >= 2:
        reasons.append("Estimated time needed is on the higher side.")
    if teacher_posted == 1:
        reasons.append("Posted by your instructor.")

    if 0.4 <= prob <= 0.6:
        reasons.append("Confidence is uncertain here, so use your judgment.")
        
    return reasons

@app.route('/predict_one', methods=['POST'])
def predict_one():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = normalize_row_for_model(request.json)
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
    
    data_list = [normalize_row_for_model(r) for r in request.json]
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
