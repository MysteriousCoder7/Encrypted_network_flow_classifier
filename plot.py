import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report
)


BASE = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(
    BASE,
    "selected_flows",
    "all_test_predictions.csv"
)

OUTPUT_DIR = os.path.join(
    BASE,
    "selected_flows",
    "plots"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)


df = pd.read_csv(INPUT_FILE)

models = [
    "No-IBNN",
    "IBNN",
    "Fuzzy-GCD",
    "Fuzzy-GCD + IBNN"
]

true_labels = df["true_label"].to_numpy()

all_labels = sorted(
    df["true_label"].unique()
)


metrics = []

for model in models:
    predictions = df[model].to_numpy()

    metrics.append({
        "Model": model,
        "Accuracy": accuracy_score(
            true_labels,
            predictions
        ),
        "Precision": precision_score(
            true_labels,
            predictions,
            average="weighted",
            zero_division=0
        ),
        "Recall": recall_score(
            true_labels,
            predictions,
            average="weighted",
            zero_division=0
        ),
        "F1": f1_score(
            true_labels,
            predictions,
            average="weighted",
            zero_division=0
        )
    })


metrics_df = pd.DataFrame(metrics)

print("\nOverall Metrics")
print("=" * 80)
print(metrics_df.to_string(index=False))


metrics_df.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "overall_metrics.csv"
    ),
    index=False
)


metric_names = [
    "Accuracy",
    "Precision",
    "Recall",
    "F1"
]

x = np.arange(len(models))
width = 0.2

plt.figure(figsize=(12, 7))

for i, metric in enumerate(metric_names):
    plt.bar(
        x + (i - 1.5) * width,
        metrics_df[metric],
        width,
        label=metric
    )

plt.xticks(
    x,
    models,
    rotation=15
)

plt.ylabel("Score")
plt.xlabel("Model")
plt.title("Performance Metrics of All Four Models")
plt.ylim(0.6, 1.05)
plt.legend()

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "all_models_metrics.png"
    ),
    dpi=300
)

plt.close()


reports = {}

for model in models:
    reports[model] = pd.DataFrame(
        classification_report(
            true_labels,
            df[model].to_numpy(),
            labels=all_labels,
            output_dict=True,
            zero_division=0
        )
    ).T.loc[
        all_labels,
        ["precision", "recall", "f1-score"]
    ]


gcd_metrics = pd.DataFrame(index=all_labels)

gcd_metrics["Fuzzy-GCD_F1"] = reports[
    "Fuzzy-GCD"
]["f1-score"]

gcd_metrics["Fuzzy-GCD+IBNN_F1"] = reports[
    "Fuzzy-GCD + IBNN"
]["f1-score"]

gcd_metrics["No-IBNN_F1"] = reports[
    "No-IBNN"
]["f1-score"]

gcd_metrics["IBNN_F1"] = reports[
    "IBNN"
]["f1-score"]


gcd_metrics["GCD_Improvement_NoIBNN"] = (
    gcd_metrics["Fuzzy-GCD_F1"]
    -
    gcd_metrics["No-IBNN_F1"]
)

gcd_metrics["GCD_Improvement_IBNN"] = (
    gcd_metrics["Fuzzy-GCD+IBNN_F1"]
    -
    gcd_metrics["IBNN_F1"]
)

gcd_metrics["Highest_GCD_Improvement"] = gcd_metrics[
    [
        "GCD_Improvement_NoIBNN",
        "GCD_Improvement_IBNN"
    ]
].max(axis=1)


gcd_metrics = gcd_metrics.sort_values(
    "Highest_GCD_Improvement",
    ascending=False
)


gcd_metrics.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "gcd_label_metrics.csv"
    )
)


top_n = 10

top_labels = gcd_metrics.head(top_n)

print("\nLabels With Highest GCD Improvement")
print("=" * 80)
print(top_labels.to_string())


x = np.arange(len(top_labels))
width = 0.35

plt.figure(figsize=(14, 7))

plt.bar(
    x - width / 2,
    top_labels["GCD_Improvement_NoIBNN"],
    width,
    label="Fuzzy-GCD vs No-IBNN"
)

plt.bar(
    x + width / 2,
    top_labels["GCD_Improvement_IBNN"],
    width,
    label="Fuzzy-GCD + IBNN vs IBNN"
)

plt.axhline(
    0,
    linewidth=1
)

plt.xticks(
    x,
    top_labels.index,
    rotation=45,
    ha="right"
)

plt.ylabel("F1-score Improvement")
plt.xlabel("Application Label")
plt.title("Labels With Highest GCD-Based F1 Improvement")
plt.legend()

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "highest_gcd_labels.png"
    ),
    dpi=300
)

plt.close()


print("\nPlots saved to:")
print(OUTPUT_DIR)
