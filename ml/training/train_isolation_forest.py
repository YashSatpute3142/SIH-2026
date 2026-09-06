import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
DATA_DIR = PROJECT_ROOT / "data" / "synthetic"
DEFAULT_MODELS_DIR = PROJECT_ROOT / "models"

sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import text
from database.session import SessionLocal

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

MODEL_NAME = "isolation_forest"

FEATURE_COLUMNS = [
    "tilt_x",
    "tilt_y",
    "tilt_magnitude",
    "displacement_mm",
    "displacement_rate",
    "vibration_rms",
    "vibration_peak",
    "vibration_variance",
    "crack_width_mm",
    "crack_detected",
    "temperature",
    "humidity",
    "battery_voltage",
    "rssi",
    "packet_loss",
    "tilt_rate",
    "displacement_rate_smoothed",
    "crack_growth_rate",
    "rolling_mean_displacement",
    "rolling_std_displacement",
    "vibration_energy",
    "neighbor_displacement_diff",
    "missing_packet_count",
    "battery_trend",
    "rssi_trend",
    "data_quality_score",
]


def find_latest_dataset():
    candidates = sorted(DATA_DIR.glob("training_dataset_*.csv"))
    if not candidates:
        raise FileNotFoundError(f"No training_dataset_*.csv found in {DATA_DIR}")
    return candidates[-1]


def load_features(df):
    feature_df = df[FEATURE_COLUMNS].copy()
    feature_df["crack_detected"] = feature_df["crack_detected"].astype(int)
    return feature_df


def deactivate_previous_versions(db):
    db.execute(
        text("UPDATE model_versions SET is_active = FALSE WHERE model_name = :model_name AND is_active = TRUE"),
        {"model_name": MODEL_NAME},
    )
    db.commit()


def insert_model_version(db, version, file_path, metrics):
    db.execute(
        text(
            """
            INSERT INTO model_versions
                (model_name, version, file_path, trained_at, training_data_source, metrics, is_active)
            VALUES
                (:model_name, :version, :file_path, :trained_at, :training_data_source, :metrics, TRUE)
            """
        ),
        {
            "model_name": MODEL_NAME,
            "version": version,
            "file_path": file_path,
            "trained_at": datetime.now(timezone.utc),
            "training_data_source": "synthetic",
            "metrics": json.dumps(metrics),
        },
    )
    db.commit()


def summarize_by_risk_level(df, anomaly_scores, anomaly_flags):
    summary = {}
    working = df.copy()
    working["anomaly_score"] = anomaly_scores
    working["is_anomaly"] = anomaly_flags
    for level, group in working.groupby("risk_level"):
        summary[level] = {
            "count": int(len(group)),
            "mean_anomaly_score": float(group["anomaly_score"].mean()),
            "anomaly_rate": float(group["is_anomaly"].mean()),
        }
    return summary


def main():
    parser = argparse.ArgumentParser(description="Train global Isolation Forest on GREEN-baseline synthetic data")
    parser.add_argument("--dataset-path", type=str, default=None)
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--contamination", type=str, default="0.05")
    parser.add_argument("--models-dir", type=str, default=str(DEFAULT_MODELS_DIR))
    args = parser.parse_args()

    dataset_path = Path(args.dataset_path) if args.dataset_path else find_latest_dataset()
    logger.info("Loading dataset from %s", dataset_path)
    df = pd.read_csv(dataset_path)
    logger.info("Loaded %s rows", len(df))
    logger.info("Risk level distribution:\n%s", df["risk_level"].value_counts().to_string())

    train_df = df[df["risk_level"] == "GREEN"].reset_index(drop=True)
    if len(train_df) < 50:
        raise ValueError(f"Only {len(train_df)} GREEN rows available, need more for a stable baseline")
    logger.info("Training on %s GREEN rows", len(train_df))

    train_features = load_features(train_df)
    imputer = SimpleImputer(strategy="median")
    train_features_imputed = imputer.fit_transform(train_features)

    contamination = args.contamination
    if contamination != "auto":
        contamination = float(contamination)

    model = IsolationForest(
        n_estimators=args.n_estimators,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(train_features_imputed)

    all_features = load_features(df)
    all_features_imputed = imputer.transform(all_features)
    anomaly_scores = model.decision_function(all_features_imputed)
    predictions = model.predict(all_features_imputed)
    anomaly_flags = predictions == -1

    risk_level_summary = summarize_by_risk_level(df, anomaly_scores, anomaly_flags)
    logger.info("Anomaly score / rate by risk_level:")
    for level, stats in risk_level_summary.items():
        logger.info(
            "  %s count=%s mean_score=%.4f anomaly_rate=%.2f%%",
            level, stats["count"], stats["mean_anomaly_score"], stats["anomaly_rate"] * 100,
        )

    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    timestamp_suffix = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    version = f"v{timestamp_suffix}"
    output_path = models_dir / f"{MODEL_NAME}_{version}.pkl"

    artifact = {
        "model": model,
        "imputer": imputer,
        "feature_columns": FEATURE_COLUMNS,
        "trained_at": timestamp_suffix,
        "training_row_count": len(train_df),
        "contamination": args.contamination,
        "n_estimators": args.n_estimators,
    }
    joblib.dump(artifact, output_path)
    logger.info("Saved model artifact to %s", output_path)

    metrics = {
        "training_row_count": int(len(train_df)),
        "total_row_count": int(len(df)),
        "n_estimators": args.n_estimators,
        "contamination": args.contamination,
        "dataset_path": str(dataset_path),
        "risk_level_summary": risk_level_summary,
    }

    db = SessionLocal()
    try:
        deactivate_previous_versions(db)
        insert_model_version(db, version, str(output_path), metrics)
        logger.info("Registered model_versions row: model_name=%s version=%s is_active=True", MODEL_NAME, version)
    finally:
        db.close()


if __name__ == "__main__":
    main()
