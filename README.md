# Network Traffic Classifier UI

This project provides a JavaScript frontend and FastAPI backend for the four trained traffic classifiers:

- No-IBNN
- IBNN
- Fuzzy-GCD
- Fuzzy-GCD + IBNN

The frontend accepts one flow in JSON format using the same feature names used by the notebook.

The backend expects the trained artifacts exported by the notebook under `models/`.

Required model artifacts:

- `no_ibnn.pt`
- `ibnn.pt`
- `fuzzy_gcd.pt`
- `fuzzy_gcd_ibnn.pt`
- `feature_scaler.pkl`
- `gcd_scaler.pkl`
- `label_encoder.pkl`
- `feature_names.npy`
- `config.json`

Copy those files from `/kaggle/working/models/` into this project's `models/` directory.

## Run backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite.

The frontend uses port 5173 by default and calls the backend on port 8000.

## Input format

A single JSON object is accepted. It should contain the `outer_*` numeric features used during training and `outer_splt_ps`.

Example:

```json
{
  "outer_packet_count": 12,
  "outer_bytes": 5400,
  "outer_duration_ms": 1250,
  "outer_splt_ps": [512, 1024, 512, 1008, 512]
}
```

The exact feature names required by your trained model are available in `feature_names.npy`. The UI also reports missing features if the supplied flow does not contain them.

`outer_splt_ps` is used for the Fuzzy-GCD transformation. The other models use the scaled encrypted-side numeric feature vector.

## Important

The project source does not contain your trained weights because model weights are not embedded in the notebook. Copy the exported `.pt`, `.pkl`, `.npy`, and `.json` artifacts into `models/`.
