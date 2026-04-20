# PriorityPing: Smart Academic Notification Triage

PriorityPing is a machine learning-powered web application designed to help students manage academic notifications. It classifies notifications (assignments, quizzes, announcements) as "Urgent," "Review Soon," or "Low Priority" using a Logistic Regression model trained on synthetic student data.

## 🛠 Tech Stack

- **Frontend**: React (TypeScript), Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Python, Flask, Flask-CORS.
- **Machine Learning**: Scikit-learn, Pandas, NumPy, Joblib.

## 📚 Open-Source Code & Dependencies

This project was built using the following open-source libraries and frameworks:

### Frontend
- **React & Vite**: Used as the base framework and build tool.
- **Tailwind CSS**: Used for all styling and responsive design.
- **Motion (framer-motion)**: Used for layout transitions and smooth entry/exit animations of notification cards.
- **Lucide React**: Used for iconography.
- **Axios**: Used for making HTTP requests to the Flask backend.

### Backend & ML
- **Flask**: Used to serve the prediction API.
- **Scikit-learn**: Used for the machine learning pipeline (StandardScaler, OneHotEncoder, LogisticRegression).
- **Pandas/NumPy**: Used for data manipulation and synthetic dataset generation.
- **Joblib**: Used for model serialization.

## 🚀 Implementation Details

While the project started from a basic React + Vite boilerplate, the following nontrivial components were implemented from scratch:

### 1. Synthetic Dataset Generator (`generate_data.py`)
- Created a template-based system to generate realistic academic notification titles.
- Implemented logic to simulate real-world correlations (e.g., "quiz" types are almost always graded and require submission).
- Developed a multi-rule labeling system to define ground-truth "urgency" based on deadlines, grading status, and teacher authorship.

### 2. Machine Learning Pipeline (`train_model.py`)
- Engineered a feature pipeline that processes numeric, categorical, and binary data.
- Implemented a Logistic Regression classifier to provide both hard labels and probability scores for "urgency."
- Integrated cross-validation and classification reporting to ensure model reliability.

### 3. Triage API (`app.py`)
- Built a Flask server with endpoints for single-notification triage and batch processing.
- **Custom Reasoning Engine**: Implemented logic to translate model inputs and feature values into human-readable explanations (e.g., mapping a high weight on `is_graded` to the reason "This is a graded task").

### 4. Smart Frontend (`src/App.tsx`)
- **Interactive Feed**: Created a dynamic feed that sorts notifications by confidence score upon prioritization.
- **Urgency Tiering**: Implemented a color-coded triage system (Red/Yellow/Green) based on predicted confidence thresholds.
- **Custom Form**: Built a submission form with programmatic feature extraction (scanning the title for urgent keywords automatically).
- **Accessible Design**: Followed clean, high-contrast design principles using Tailwind's fluid layout utilities.

## 📋 How to Run

1. **Backend**:
   ```bash
   pip install flask flask-cors pandas scikit-learn joblib
   python generate_data.py
   python train_model.py
   python app.py
   ```

2. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
