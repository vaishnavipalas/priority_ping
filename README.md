# PriorityPing Chrome Extension

A smart academic notification triage tool for Carnegie Mellon's Canvas LMS (canvas.cmu.edu).

## Features
- **Client-Side ML**: Uses a Logistic Regression classifier running entirely in your browser.
- **Privacy First**: No student data ever leaves the device.
- **Actionable Triage**: Splits notifications into "Needs Action" and "FYI" columns.
- **Explainability**: Click "Why?" on any card to see the features driving the urgency score.
- **Customizable**: Boost or mute specific courses via the extension popup.

## Setup Instructions

### 1. Generate the Model (Optional)
If you have Python 3 installed with `pandas` and `scikit-learn`, you can regenerate the model weights:
```bash
python3 scripts/generate_data.py
python3 scripts/train_model.py
```
*Note: A functional `model/weights.json` is already provided in this build.*

### 2. Install the Extension
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder containing these files.

### 3. Usage
1. Navigate to Carnegie Mellon's Canvas (`canvas.cmu.edu`).
2. Ensure you are on the **Dashboard** or **Recent Activity** feed.
3. The PriorityPing panel will appear on the top right.

## File Structure
- `manifest.json`: Extension configuration (MV3).
- `background.js`: Orchestrates script injection.
- `content.js`: Parses Canvas DOM and handles orchestration.
- `classifier.js`: The ML inference engine.
- `ui.js`: Manages the floating interface and interactions.
- `styles.css`: Visual styling for the panel.
- `scripts/`: Data generation and training scripts.
- `model/weights.json`: Exported model weights used for inference.
