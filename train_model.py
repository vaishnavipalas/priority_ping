import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# Load data
df = pd.read_csv("notifications.csv")

# Drop unused columns
X = df.drop(columns=["notification_id", "title", "urgent_label"])
if "has_deadline" not in X.columns:
    X["has_deadline"] = X["notification_type"].isin(["assignment_due", "quiz_due"]).astype(int)
y = df["urgent_label"]

# Define features
numeric_features = ["days_until_deadline", "estimated_time_hours"]
categorical_features = ["notification_type"]
binary_features = [
    "has_deadline",
    "is_graded",
    "requires_submission",
    "title_has_urgent_keyword",
    "has_time_reference",
    "teacher_posted",
]

# Preprocessing
preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ("bin", "passthrough", binary_features)
    ]
)

# Pipeline
model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression())
    ]
)

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

# Save model
joblib.dump(model, "model.pkl")
print("Model saved as model.pkl")
