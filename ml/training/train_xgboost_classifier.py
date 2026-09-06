import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

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

MODEL_NAME = "xgboost_classifier"

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


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost multiclass risk-level classifier")
    parser.add_argument("--dataset-path", type=str, default=None)
    parser.add_argument("--test-size", type=float, default=0.3)
    parser.add_argument("--n-estimators", type=int, default=300)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--models-dir", type=str, default=str(DEFAULT_MODELS_DIR))
    args = parser.parse_args()

    dataset_path = Path(args.dataset_path) if args.dataset_path else find_latest_dataset()
    logger.info("Loading dataset from %s", dataset_path)
    df = pd.read_csv(dataset_path)
    logger.info("Loaded %s rows", len(df))
    logger.info("Risk level distribution:\n%s", df["risk_level"].value_counts().to_string())

    features = load_features(df)
    label_encoder = LabelEncoder()
    encoded_labels = label_encoder.fit_transform(df["risk_level"])

    splitter = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=42)
    train_idx, test_idx = next(splitter.split(features, encoded_labels, groups=df["node_id"]))

    X_train_raw, X_test_raw = features.iloc[train_idx], features.iloc[test_idx]

    imputer = SimpleImputer(strategy="median")
    X_train = pd.DataFrame(imputer.fit_transform(X_train_raw), columns=FEATURE_COLUMNS, index=X_train_raw.index)
    X_test = pd.DataFrame(imputer.transform(X_test_raw), columns=FEATURE_COLUMNS, index=X_test_raw.index)
    y_train, y_test = encoded_labels[train_idx], encoded_labels[test_idx]

    logger.info("Train nodes: %s", sorted(df["node_id"].iloc[train_idx].unique()))
    logger.info("Test nodes: %s", sorted(df["node_id"].iloc[test_idx].unique()))
    logger.info("Train risk_level distribution:\n%s", df["risk_level"].iloc[train_idx].value_counts().to_string())
    logger.info("Test risk_level distribution:\n%s", df["risk_level"].iloc[test_idx].value_counts().to_string())

    sample_weight = compute_sample_weight("balanced", y_train)

    model = XGBClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        objective="multi:softprob",
        num_class=len(label_encoder.classes_),
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train, sample_weight=sample_weight)

    y_pred = model.predict(X_test)
    report = classification_report(
        y_test, y_pred, target_names=label_encoder.classes_, output_dict=True, zero_division=0
    )
    report_text = classification_report(
        y_test, y_pred, target_names=label_encoder.classes_, zero_division=0
    )
    logger.info("Classification report:\n%s", report_text)

    conf_matrix = confusion_matrix(y_test, y_pred)
    logger.info("Confusion matrix (rows=actual, cols=predicted, order=%s):\n%s", list(label_encoder.classes_), conf_matrix)

    importances = model.feature_importances_
    importance_ranking = sorted(
        zip(FEATURE_COLUMNS, importances.tolist()), key=lambda pair: pair[1], reverse=True
    )
    logger.info("Top 10 feature importances:")
    for feature_name, importance in importance_ranking[:10]:
        logger.info("  %s: %.4f", feature_name, importance)

    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    timestamp_suffix = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    version = f"v{timestamp_suffix}"
    output_path = models_dir / f"{MODEL_NAME}_{version}.pkl"

    artifact = {
        "model": model,
        "imputer": imputer,
        "label_encoder": label_encoder,
        "feature_columns": FEATURE_COLUMNS,
        "trained_at": timestamp_suffix,
    }
    joblib.dump(artifact, output_path)
    logger.info("Saved model artifact to %s", output_path)

    metrics = {
        "training_row_count": int(len(train_idx)),
        "test_row_count": int(len(test_idx)),
        "dataset_path": str(dataset_path),
        "classes": label_encoder.classes_.tolist(),
        "classification_report": report,
        "confusion_matrix": conf_matrix.tolist(),
        "feature_importance_ranking": importance_ranking,
        "disclaimer": (
            "Trained exclusively on synthetic simulator scenarios. Not validated against real "
            "subsidence outcomes or field data. Decision-support only, not a standalone operational decision."
        ),
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
