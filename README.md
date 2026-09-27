# Encrypted Network Flow Classifier

A machine learning-based system for classifying encrypted network traffic flows into application-level categories using statistical flow features.

The project evaluates four classification models with and without **Fuzzy-GCD features** and **Information Bottleneck Neural Network (IBNN)** processing:

* No-IBNN
* IBNN
* Fuzzy-GCD
* Fuzzy-GCD + IBNN

The system includes a backend for model inference and a frontend for interacting with the classifier.

## Project Overview

Encrypted traffic cannot be classified using application-layer payload contents because the payload is protected by encryption. This project instead uses statistical characteristics of network flows, such as:

* Flow duration
* Packet rate
* Byte rate
* Bytes in/out
* Packet inter-arrival times
* Minimum, mean, standard deviation and maximum packet inter-arrival times

The feature pipeline uses 22 flow-level features.

Fuzzy-GCD processing extracts additional information from packet-size sequences. For each flow, it searches for a suitable GCD-like packet-size unit and derives four features:

1. Estimated GCD
2. Mean residual
3. Normalized mean residual
4. Fraction of packet sizes within the tolerance

The implementation searches candidate values from 8 to 256 bytes with a tolerance of 4 bytes.

## Models

### 1. No-IBNN

The baseline model uses the original normalized flow features without IBNN processing or Fuzzy-GCD feature replacement.

### 2. IBNN

The IBNN model uses the original flow features and an Information Bottleneck Neural Network.

### 3. Fuzzy-GCD

The Fuzzy-GCD model replaces selected flow features with normalized Fuzzy-GCD features before classification.

### 4. Fuzzy-GCD + IBNN

This model combines Fuzzy-GCD feature extraction with the IBNN architecture.

The prediction pipeline constructs both the standard feature representation and the GCD-enhanced representation before running the four models.

## Architecture

```text
Network Flow
     |
     v
Statistical Flow Features
     |
     +----------------------+
     |                      |
     v                      v
Original Features      Packet Size Sequence
     |                      |
     |                      v
     |                 Fuzzy-GCD
     |                      |
     |                 GCD Features
     |                      |
     +----------+-----------+
                |
                v
        Feature Representation
                |
       +--------+--------+
       |        |        |
       v        v        v
    No-IBNN   IBNN    Fuzzy-GCD
                         |
                         v
                  Fuzzy-GCD + IBNN
                         |
                         v
                    Prediction
```

## Dataset

The original dataset is intentionally excluded from the repository.

The evaluation pipeline combines two dataset sessions:

```text
VPN-nonVPN-Dataset/
└── Data/
    ├── session1/
    └── session2/
```

The two session flow files are loaded and combined before preprocessing.

Classes with fewer than 100 samples are removed before evaluation.

The remaining data is split into training and testing sets using a stratified 70/30 split with random seed 42.

## Features

The baseline feature vector contains 22 features:

```text
outer_bytes
outer_duration_ms
outer_first_matched_time_ms
outer_last_matched_time_ms
outer_capture_duration_ms
outer_packet_rate
outer_byte_rate
outer_bytes_in
outer_bytes_out
outer_min_piat_ms_in
outer_mean_piat_ms_in
outer_stddev_piat_ms_in
outer_max_piat_ms_in
outer_min_piat_ms_out
outer_mean_piat_ms_out
outer_stddev_piat_ms_out
outer_max_piat_ms_out
outer_min_piat_ms
outer_mean_piat_ms
outer_stddev_piat_ms
outer_max_piat_ms
```

The feature scaler and GCD scaler are loaded from the `models/` directory.

## Repository Structure

```text
Encrypted_network_flow_classifier/
│
├── backend/
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── models/
│   ├── config.json
│   ├── feature_names.npy
│   ├── feature_scaler.pkl
│   ├── gcd_scaler.pkl
│   ├── label_encoder.pkl
│   ├── no_ibnn.pt
│   ├── ibnn.pt
│   ├── fuzzy_gcd.pt
│   └── fuzzy_gcd_ibnn.pt
│
├── analyse.py
├── plot.py
├── predict_from_file.py
├── predict_one_flow.py
├── README.md
└── .gitignore
```

The repository does not include the original dataset, generated selected flows, frontend `node_modules`, or Python virtual environments.

## Running the Backend

Create and activate a Python virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Start the backend using the project's backend configuration.

## Running the Frontend

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend uses Vite.

## Prediction Scripts

### Predict From a File

The repository contains:

```text
predict_from_file.py
```

for running classification on a flow file.

### Predict a Single Flow

The repository also contains:

```text
predict_one_flow.py
```

for classifying an individual flow.

## Evaluation

The evaluation pipeline:

1. Loads the dataset.
2. Filters classes based on minimum class count.
3. Performs a stratified train/test split.
4. Applies feature scaling.
5. Generates Fuzzy-GCD features.
6. Creates the standard and GCD-enhanced feature representations.
7. Runs all four models.
8. Converts predictions back to application labels.
9. Saves the predictions for further analysis.
   The complete test predictions are saved as:

```text
selected_flows/all_test_predictions.csv
```

## Evaluation Analysis

The project also identifies flows where:

* All four models correctly classify the flow.
* Both GCD-based models correctly classify the flow while both non-GCD models fail.

The second category is particularly useful for analyzing the contribution of Fuzzy-GCD features.

Distinct-label examples are selected and saved as CSV and Parquet files.

## Metrics and Visualization

The project includes visualization scripts for comparing model performance and analyzing labels that benefit from GCD features.

Generated plots include:

```text
all_models_metrics.png
highest_gcd_labels.png
```

The plots can be used to compare the four models and identify application labels where GCD-based features provide the largest improvement.

## Reproducibility

The evaluation uses:

```text
Random seed: 42
Test size: 30%
Minimum class count: 100
```

The same preprocessing pipeline is used for all four models to make the model comparison consistent.

## Notes

The following files/directories are intentionally excluded from version control:

```text
VPN-nonVPN-Dataset/
selected_flows/
frontend/node_modules/
backend/.venv/
```

These contain either the original dataset, generated evaluation data, or locally installed dependencies.

The trained model files and preprocessing artifacts are stored under `models/`.

## Technology Stack

### Machine Learning

* Python
* PyTorch
* Scikit-learn
* NumPy
* Pandas
* Joblib

### Backend

* Python
* FastAPI/Uvicorn components

### Frontend

* React
* Vite
* Tailwind CSS

## Authors

**Sambhav Singh**

NITK Surathkal
