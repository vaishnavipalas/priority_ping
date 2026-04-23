import pandas as pd
import numpy as np
import json
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

def train():
    df = pd.read_csv("scripts/notifications_dataset.csv")
    
    # One-hot encode notification_type
    # We want to keep assignment_due as the baseline (first category)
    # The categories order should be stable
    categories = [
        "assignment_due", "quiz_exam", "grade_posted", "announcement_urgent",
        "announcement_info", "discussion", "group_collab", "event_optional"
    ]
    
    df['notification_type'] = pd.Categorical(df['notification_type'], categories=categories)
    type_dummies = pd.get_dummies(df['notification_type'], prefix='notification_type', drop_first=True)
    
    # Feature list
    base_features = [
        "has_deadline", "is_graded", "requires_submission",
        "teacher_posted", "estimated_time_hours", "title_has_urgent_kw",
        "has_time_reference", "course_credits"
    ]
    
    X = pd.concat([df[base_features], type_dummies], axis=1)
    y = df['priority']
    
    feature_names = X.columns.tolist()
    
    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Normalization
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Model
    model = LogisticRegression(max_iter=1000, multi_class='multinomial', random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Eval
    y_pred = model.predict(X_test_scaled)
    print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
    print(classification_report(y_test, y_pred))
    
    # Export
    weights = {
        "intercept": model.intercept_.tolist(),
        "coef": model.coef_.tolist(),
        "classes": model.classes_.tolist(),
        "feature_names": feature_names,
        "feature_means": {name: float(mean) for name, mean in zip(feature_names, scaler.mean_)},
        "feature_stds": {name: float(std) for name, std in zip(feature_names, scaler.scale_)},
        "notification_type_categories": categories
    }
    
    with open("model/weights.json", "w") as f:
        json.dump(weights, f, indent=2)
    
    print("Exported model/weights.json")

if __name__ == "__main__":
    train()
