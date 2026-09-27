import os
import sys
import ast
import numpy as np
import pandas as pd
import torch

sys.path.insert(0, os.getcwd())

from backend.app import models, classes, scaler, gcd_scaler, feature_names, replace_idx
from backend.app import fuzzy_gcd_features, make_map

PARQUET = "VPN-nonVPN-Dataset/Data/session1/session1_flows.parquet"

df = pd.read_parquet(PARQUET)

print("Number of flows:", len(df))
print("Columns:")
print(df.columns.tolist())

idx = int(input(f"\nEnter flow index (0-{len(df)-1}): "))

flow = df.iloc[idx]

print("\nSelected flow:")
print("Index:", idx)

if "application_name" in flow:
    print("True label:", flow["application_name"])

features = np.array(
    [float(flow[name]) for name in feature_names],
    dtype=np.float32
).reshape(1, -1)

features_df = pd.DataFrame(features, columns=feature_names)

scaled = scaler.transform(features_df)

sizes = np.asarray(
    ast.literal_eval(flow["outer_splt_ps"]),
    dtype=np.float32
)

gcd_features = fuzzy_gcd_features(sizes)

gcd_scaled = gcd_scaler.transform(
    pd.DataFrame(
        [gcd_features],
        columns=["gcd_k", "gcd_residual_mean", "gcd_residual_norm", "gcd_within_tol"]
    )
)

gcd_scaled = np.asarray(gcd_scaled, dtype=np.float32)

features_gcd = scaled.copy()
features_gcd[:, replace_idx] = gcd_scaled

normal_map = make_map(scaled)
gcd_map = make_map(features_gcd)

normal_map = torch.tensor(normal_map, dtype=torch.float32)
gcd_map = torch.tensor(gcd_map, dtype=torch.float32)

print("\nRunning models...\n")

for name, model in models.items():
    model.eval()

    if "Fuzzy-GCD" in name:
        x = gcd_map
    else:
        x = normal_map

    with torch.no_grad():
        output = model(x)

        if isinstance(output, tuple):
            output = output[0]

        probabilities = torch.softmax(output, dim=-1)

        prediction = torch.argmax(
            probabilities,
            dim=-1
        ).item()

        confidence = probabilities[0, prediction].item() * 100

    print(
        f"{name:20s} -> "
        f"{classes[prediction]:25s} "
        f"{confidence:7.2f}%"
    )

print("\nGCD features:")
print("k:", gcd_features[0])
print("mean residual:", gcd_features[1])
print("normalized residual:", gcd_features[2])
print("within tolerance:", gcd_features[3])
