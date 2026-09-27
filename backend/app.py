import os
import sys
import ast
import json
import math
import io

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
import joblib

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE, "models")
DEVICE = torch.device("cpu")

app = FastAPI(title="Network Traffic Classifier")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


with open(os.path.join(MODEL_DIR, "config.json")) as f:
    config = json.load(f)

classes = config["classes"]

feature_names = [
    "outer_bytes",
    "outer_duration_ms",
    "outer_first_matched_time_ms",
    "outer_last_matched_time_ms",
    "outer_capture_duration_ms",
    "outer_packet_rate",
    "outer_byte_rate",
    "outer_bytes_in",
    "outer_bytes_out",
    "outer_min_piat_ms_in",
    "outer_mean_piat_ms_in",
    "outer_stddev_piat_ms_in",
    "outer_max_piat_ms_in",
    "outer_min_piat_ms_out",
    "outer_mean_piat_ms_out",
    "outer_stddev_piat_ms_out",
    "outer_max_piat_ms_out",
    "outer_min_piat_ms",
    "outer_mean_piat_ms",
    "outer_stddev_piat_ms",
    "outer_max_piat_ms",
]

feature_scaler = joblib.load(
    os.path.join(
        MODEL_DIR,
        "feature_scaler.pkl"
    )
)

gcd_scaler = joblib.load(
    os.path.join(
        MODEL_DIR,
        "gcd_scaler.pkl"
    )
)

replace_idx_path = os.path.join(
    MODEL_DIR,
    "replace_idx.npy"
)

if os.path.exists(replace_idx_path):
    replace_idx = np.load(
        replace_idx_path
    ).astype(np.int64)
else:
    replace_idx = np.array(
        [5, 2, 7, 1],
        dtype=np.int64
    )

num_classes = int(config["num_classes"])
grid_side = int(config["grid_side"])
z_dim = int(config["z_dim"])
dropout = float(config["dropout"])


class PaperConvEncoder(nn.Module):
    def __init__(self):
        super().__init__()

        self.conv1 = nn.Conv2d(
            1,
            32,
            5,
            padding=2
        )

        self.conv2 = nn.Conv2d(
            32,
            32,
            5,
            padding=2
        )

        self.conv3 = nn.Conv2d(
            32,
            64,
            3,
            padding=1
        )

        self.conv4 = nn.Conv2d(
            64,
            64,
            3,
            padding=1
        )

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x3 = F.relu(self.conv3(x))
        x4 = F.relu(self.conv4(x3))

        return torch.cat(
            [x3, x4],
            dim=1
        )


class IBLayer(nn.Module):
    def __init__(self, in_dim, z_dim):
        super().__init__()

        self.mu = nn.Linear(
            in_dim,
            z_dim
        )

        self.logvar = nn.Linear(
            in_dim,
            z_dim
        )

    def forward(self, x, num_samples=1):
        mu = self.mu(x)

        logvar = torch.clamp(
            self.logvar(x),
            -10.0,
            10.0
        )

        var = torch.exp(logvar)
        std = torch.exp(0.5 * logvar)

        z = mu

        if self.training or num_samples > 1:
            if num_samples == 1:
                z = mu + std * torch.randn_like(std)
            else:
                eps = torch.randn(
                    num_samples,
                    *mu.shape,
                    device=mu.device
                )

                z = (
                    mu.unsqueeze(0)
                    + eps * std.unsqueeze(0)
                ).mean(0)

        mu_i = mu.unsqueeze(1)
        mu_j = mu.unsqueeze(0)

        var_i = var.unsqueeze(1)
        var_j = var.unsqueeze(0)

        logvar_i = logvar.unsqueeze(1)
        logvar_j = logvar.unsqueeze(0)

        kl = 0.5 * (
            logvar_j
            - logvar_i
            + (
                var_i
                + (mu_i - mu_j).pow(2)
            ) / var_j
            - 1.0
        )

        kl = kl.sum(-1)

        b = x.size(0)

        if b == 1:
            mi = torch.zeros(
                (),
                device=x.device
            )
        else:
            mi = -(
                torch.logsumexp(
                    -kl,
                    dim=1
                )
                - math.log(b)
            ).mean()

        return z, mi


class IBNN(nn.Module):
    def __init__(
        self,
        num_classes,
        z_dim=128,
        dropout=0.1
    ):
        super().__init__()

        self.encoder = PaperConvEncoder()

        with torch.no_grad():
            d = self.encoder(
                torch.zeros(
                    1,
                    1,
                    grid_side,
                    grid_side
                )
            ).flatten(1).shape[1]

        self.extract = nn.Sequential(
            nn.Linear(d, 128),
            nn.ReLU(True),
            nn.Dropout(dropout)
        )

        self.ib = IBLayer(
            128,
            z_dim
        )

        self.classifier = nn.Sequential(
            nn.Linear(z_dim, 128),
            nn.ReLU(True),
            nn.Dropout(dropout),
            nn.Linear(128, 256),
            nn.ReLU(True),
            nn.Dropout(dropout),
            nn.Linear(
                256,
                num_classes
            )
        )

    def forward(
        self,
        x,
        num_samples=1
    ):
        x = self.encoder(x).flatten(1)
        x = self.extract(x)

        z, mi = self.ib(
            x,
            num_samples
        )

        return self.classifier(z), mi


class NoIBNN(nn.Module):
    def __init__(
        self,
        num_classes,
        dropout=0.1
    ):
        super().__init__()

        self.encoder = PaperConvEncoder()

        with torch.no_grad():
            d = self.encoder(
                torch.zeros(
                    1,
                    1,
                    grid_side,
                    grid_side
                )
            ).flatten(1).shape[1]

        self.extract = nn.Sequential(
            nn.Linear(d, 128),
            nn.ReLU(True),
            nn.Dropout(dropout)
        )

        self.classifier = nn.Sequential(
            nn.Linear(128, 128),
            nn.ReLU(True),
            nn.Dropout(dropout),
            nn.Linear(128, 256),
            nn.ReLU(True),
            nn.Dropout(dropout),
            nn.Linear(
                256,
                num_classes
            )
        )

    def forward(self, x):
        x = self.encoder(x).flatten(1)
        x = self.extract(x)

        return self.classifier(x)


def load_model(path, ib=False):
    if ib:
        model = IBNN(
            num_classes,
            z_dim,
            dropout
        )
    else:
        model = NoIBNN(
            num_classes,
            dropout
        )

    state = torch.load(
        path,
        map_location=DEVICE
    )

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()

    return model


models = {
    "No-IBNN": load_model(
        os.path.join(
            MODEL_DIR,
            "no_ibnn.pt"
        )
    ),

    "IBNN": load_model(
        os.path.join(
            MODEL_DIR,
            "ibnn.pt"
        ),
        True
    ),

    "Fuzzy-GCD": load_model(
        os.path.join(
            MODEL_DIR,
            "fuzzy_gcd.pt"
        )
    ),

    "Fuzzy-GCD + IBNN": load_model(
        os.path.join(
            MODEL_DIR,
            "fuzzy_gcd_ibnn.pt"
        ),
        True
    )
}


def fuzzy_gcd_features(
    sizes,
    k_min=8,
    k_max=256,
    tolerance=4
):
    sizes = np.asarray(
        sizes,
        dtype=np.float32
    )

    sizes = sizes[
        np.isfinite(sizes) &
        (sizes > 0)
    ]

    if len(sizes) == 0:
        return np.zeros(
            4,
            dtype=np.float32
        )

    best_k = 8.0
    best_score = float("inf")

    for k in range(
        k_min,
        k_max + 1
    ):
        mult = np.maximum(
            1.0,
            np.rint(sizes / k)
        )

        res = np.abs(
            sizes - mult * k
        )

        score = res.mean()

        if score < best_score:
            best_score = score
            best_k = float(k)

    mult = np.maximum(
        1.0,
        np.rint(sizes / best_k)
    )

    res = np.abs(
        sizes - mult * best_k
    )

    return np.array([
        best_k,
        res.mean(),
        np.mean(res / best_k),
        np.mean(res <= tolerance)
    ], dtype=np.float32)


def parse_packet_sizes(value):
    if isinstance(
        value,
        (list, tuple, np.ndarray)
    ):
        return np.asarray(
            value,
            dtype=np.float32
        )

    if pd.isna(value):
        return np.array(
            [],
            dtype=np.float32
        )

    try:
        return np.asarray(
            ast.literal_eval(str(value)),
            dtype=np.float32
        )
    except Exception:
        return np.array(
            [],
            dtype=np.float32
        )


def make_map(x):
    padded = np.zeros(
        25,
        dtype=np.float32
    )

    padded[:21] = x

    return padded.reshape(
        1,
        1,
        5,
        5
    )


def prepare_flow(df):
    missing = [
        x
        for x in feature_names
        if x not in df.columns
    ]

    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Missing required features",
                "missing_features": missing
            }
        )

    if "outer_splt_ps" not in df.columns:
        raise HTTPException(
            status_code=422,
            detail={
                "message":
                "outer_splt_ps is required for GCD models."
            }
        )

    X = df[
        feature_names
    ].copy()

    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    ).fillna(0)

    X_scaled = feature_scaler.transform(
        X
    )[0].astype(
        np.float32
    )

    normal_map = make_map(
        X_scaled
    )

    flow = df.iloc[0]

    packet_sizes = parse_packet_sizes(
        flow["outer_splt_ps"]
    )

    gcd_features = fuzzy_gcd_features(
        packet_sizes
    )

    gcd_scaled = gcd_scaler.transform(
        gcd_features.reshape(
            1,
            -1
        )
    )[0].astype(
        np.float32
    )

    gcd_input = X_scaled.copy()

    gcd_input[
        replace_idx
    ] = gcd_scaled

    gcd_map = make_map(
        gcd_input
    )

    return (
        flow,
        normal_map,
        gcd_map,
        gcd_features,
        gcd_scaled
    )


def predict(model, x):
    with torch.no_grad():
        tensor = torch.tensor(
            x,
            dtype=torch.float32
        )

        output = model(
            tensor
        )

        if isinstance(
            output,
            tuple
        ):
            output = output[0]

        probabilities = torch.softmax(
            output,
            dim=1
        )

        prediction = int(
            torch.argmax(
                probabilities,
                dim=1
            ).item()
        )

        confidence = float(
            probabilities[
                0,
                prediction
            ].item()
        )

    return prediction, confidence, probabilities


def build_prediction(
    model_name,
    x
):
    prediction, confidence, probabilities = predict(
        models[model_name],
        x
    )

    return {
        "class": classes[prediction],
        "class_index": prediction,
        "confidence": confidence,
        "probabilities": {
            classes[i]: float(
                probabilities[
                    0,
                    i
                ].item()
            )
            for i in range(
                len(classes)
            )
        }
    }


class FlowRequest(BaseModel):
    flow: dict


@app.get("/health")
def health():
    return {
        "status": "ok",
        "classes": classes,
        "feature_count": len(feature_names)
    }


@app.get("/features")
def features():
    return {
        "feature_names": feature_names,
        "feature_count": len(feature_names)
    }


@app.post("/predict")
def predict_json(
    request: FlowRequest
):
    flow = request.flow

    df = pd.DataFrame(
        [flow]
    )

    (
        _,
        normal_map,
        gcd_map,
        gcd_features,
        gcd_scaled
    ) = prepare_flow(df)

    return {
        "outputs": {
            "No-IBNN": build_prediction(
                "No-IBNN",
                normal_map
            ),

            "IBNN": build_prediction(
                "IBNN",
                normal_map
            ),

            "Fuzzy-GCD": build_prediction(
                "Fuzzy-GCD",
                gcd_map
            ),

            "Fuzzy-GCD + IBNN": build_prediction(
                "Fuzzy-GCD + IBNN",
                gcd_map
            )
        },

        "fuzzy_gcd": {
            "best_k": float(
                gcd_features[0]
            ),
            "mean_residual": float(
                gcd_features[1]
            ),
            "normalized_residual": float(
                gcd_features[2]
            ),
            "within_tolerance_fraction": float(
                gcd_features[3]
            )
        }
    }


@app.post("/predict-file")
async def predict_file(
    file: UploadFile = File(...)
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    if not file.filename.lower().endswith(
        ".parquet"
    ):
        raise HTTPException(
            status_code=400,
            detail="Only .parquet files are supported"
        )

    try:
        contents = await file.read()

        df = pd.read_parquet(
            io.BytesIO(contents)
        )

    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not read Parquet file: {str(e)}"
        )

    if len(df) != 1:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Expected exactly one flow",
                "rows_found": len(df)
            }
        )

    (
        flow,
        normal_map,
        gcd_map,
        gcd_features,
        gcd_scaled
    ) = prepare_flow(df)

    outputs = {
        "No-IBNN": build_prediction(
            "No-IBNN",
            normal_map
        ),

        "IBNN": build_prediction(
            "IBNN",
            normal_map
        ),

        "Fuzzy-GCD": build_prediction(
            "Fuzzy-GCD",
            gcd_map
        ),

        "Fuzzy-GCD + IBNN": build_prediction(
            "Fuzzy-GCD + IBNN",
            gcd_map
        )
    }

    return {
        "file_name": file.filename,

        "flow": {
            "flow_id": str(
                flow["flow_id"]
                if "flow_id" in df.columns
                else ""
            ),
            "true_label": str(
                flow["application_name"]
                if "application_name" in df.columns
                else ""
            )
        },

        "gcd": {
            "raw": {
                "best_k": float(
                    gcd_features[0]
                ),
                "mean_residual": float(
                    gcd_features[1]
                ),
                "normalized_residual": float(
                    gcd_features[2]
                ),
                "within_tolerance_fraction": float(
                    gcd_features[3]
                )
            },

            "scaled": [
                float(x)
                for x in gcd_scaled
            ],

            "replacement_indices": [
                int(x)
                for x in replace_idx
            ]
        },

        "outputs": outputs,

        "maps": {
            "normal": normal_map[
                0,
                0
            ].tolist(),

            "gcd": gcd_map[
                0,
                0
            ].tolist()
        }
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )
