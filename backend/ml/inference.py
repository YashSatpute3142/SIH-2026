import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from ml.model_loader import model_registry, ModelNotAvailableError

logger = logging.getLogger(__name__)

DISPLACEMENT_TREND_EPSILON_MM = 0.5

RAW_FEATURE_FIELDS = (
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
)

PROCESSED_FEATURE_FIELDS = (
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
)


def build_feature_dict(raw_reading, processed_reading):
    feature_dict = {}
    for field_name in RAW_FEATURE_FIELDS:
        value = getattr(raw_reading, field_name, None)
        if field_name == "crack_detected" and value is not None:
            value = int(value)
        feature_dict[field_name] = value

    for field_name in PROCESSED_FEATURE_FIELDS:
        value = getattr(processed_reading, field_name, None) if processed_reading else None
        feature_dict[field_name] = value

    return feature_dict


def build_input_row(feature_dict, feature_columns):
    row = {column: feature_dict.get(column, None) for column in feature_columns}
    df = pd.DataFrame([row], columns=feature_columns)
    df = df.apply(pd.to_numeric, errors="coerce")
    return df


def run_isolation_forest(feature_dict):
    try:
        artifact = model_registry.get("isolation_forest")
    except ModelNotAvailableError as exc:
        logger.warning("Isolation Forest unavailable, skipping: %s", exc)
        return None

    feature_columns = artifact["feature_columns"]
    input_df = build_input_row(feature_dict, feature_columns)
    imputed = artifact["imputer"].transform(input_df)

    anomaly_score = float(artifact["model"].decision_function(imputed)[0])
    is_anomaly = artifact["model"].predict(imputed)[0] == -1

    return {
        "anomaly_score": anomaly_score,
        "anomaly_status": "anomaly" if is_anomaly else "normal",
        "model_version": model_registry.get_version("isolation_forest"),
    }


def compute_classifier_contributions(artifact, imputed_row, predicted_class_index):
    try:
        from xgboost import DMatrix

        dmatrix = DMatrix(imputed_row, feature_names=artifact["feature_columns"])
    except Exception as exc:
        logger.warning("Could not build DMatrix for classifier explainability: %s", exc)
        return None

    try:
        booster = artifact["model"].get_booster()
        contribs = booster.predict(dmatrix, pred_contribs=True)
        contribs_row = np.asarray(contribs)

        if contribs_row.ndim == 3:
            contribs_row = contribs_row[0, predicted_class_index, :]
        else:
            contribs_row = contribs_row[0]

        feature_names = list(artifact["feature_columns"]) + ["bias"]
        pairs = list(zip(feature_names, contribs_row.tolist()))
        pairs = [p for p in pairs if p[0] != "bias"]
        pairs.sort(key=lambda pair: abs(pair[1]), reverse=True)
        return {name: round(value, 5) for name, value in pairs[:5]}
    except Exception as exc:
        logger.warning("Classifier explainability computation failed, continuing without it: %s", exc)
        return None


def run_xgboost_classifier(feature_dict):
    try:
        artifact = model_registry.get("xgboost_classifier")
    except ModelNotAvailableError as exc:
        logger.warning("XGBoost classifier unavailable, skipping: %s", exc)
        return None

    feature_columns = artifact["feature_columns"]
    input_df = build_input_row(feature_dict, feature_columns)
    imputed = artifact["imputer"].transform(input_df)

    probabilities = artifact["model"].predict_proba(imputed)[0]
    predicted_index = int(np.argmax(probabilities))
    predicted_label = artifact["label_encoder"].inverse_transform([predicted_index])[0]
    predicted_probability = float(probabilities[predicted_index])

    contributions = compute_classifier_contributions(artifact, imputed, predicted_index)

    return {
        "ml_risk_class": predicted_label,
        "ml_probability": predicted_probability,
        "model_version": model_registry.get_version("xgboost_classifier"),
        "top_contributing_features": contributions,
    }


def compute_regressor_confidence(current_risk_level):
    metrics = model_registry.get_metrics("xgboost_regressor")
    if not metrics or "mae_by_current_risk_level" not in metrics:
        return None

    level_mae = metrics["mae_by_current_risk_level"].get(current_risk_level)
    if level_mae is None:
        return None

    return round(1.0 / (1.0 + level_mae), 4)


def run_xgboost_regressor(feature_dict, current_risk_level=None):
    try:
        artifact = model_registry.get("xgboost_regressor")
    except ModelNotAvailableError as exc:
        logger.warning("XGBoost regressor unavailable, skipping: %s", exc)
        return None

    feature_columns = artifact["feature_columns"]
    input_df = build_input_row(feature_dict, feature_columns)
    imputed = artifact["imputer"].transform(input_df)

    predicted_displacement_mm = float(artifact["model"].predict(imputed)[0])
    current_displacement_mm = feature_dict.get("displacement_mm")

    trend_direction = "unknown"
    if current_displacement_mm is not None:
        delta = predicted_displacement_mm - current_displacement_mm
        if delta > DISPLACEMENT_TREND_EPSILON_MM:
            trend_direction = "rising"
        elif delta < -DISPLACEMENT_TREND_EPSILON_MM:
            trend_direction = "falling"
        else:
            trend_direction = "stable"

    return {
        "predicted_displacement_mm": predicted_displacement_mm,
        "horizon_hours": artifact.get("horizon_hours", 24),
        "trend_direction": trend_direction,
        "confidence": compute_regressor_confidence(current_risk_level),
        "model_version": model_registry.get_version("xgboost_regressor"),
    }


def run_full_inference(raw_reading, processed_reading, current_risk_level=None):
    feature_dict = build_feature_dict(raw_reading, processed_reading)

    return {
        "isolation_forest": run_isolation_forest(feature_dict),
        "xgboost_classifier": run_xgboost_classifier(feature_dict),
        "xgboost_regressor": run_xgboost_regressor(feature_dict, current_risk_level),
    }


def save_anomaly(db: Session, node_id, zone_id, processed_reading_id, detected_at, if_result):
    if if_result is None:
        return None

    result = db.execute(
        text(
            """
            INSERT INTO anomalies
                (node_id, zone_id, processed_reading_id, detected_at, anomaly_score, anomaly_status, model_version)
            VALUES
                (:node_id, :zone_id, :processed_reading_id, :detected_at, :anomaly_score, :anomaly_status, :model_version)
            """
        ),
        {
            "node_id": node_id,
            "zone_id": zone_id,
            "processed_reading_id": processed_reading_id,
            "detected_at": detected_at,
            "anomaly_score": if_result["anomaly_score"],
            "anomaly_status": if_result["anomaly_status"],
            "model_version": if_result["model_version"],
        },
    )
    db.commit()
    return result.lastrowid


def save_prediction(db: Session, node_id, zone_id, predicted_at, regressor_result):
    if regressor_result is None:
        return None

    result = db.execute(
        text(
            """
            INSERT INTO predictions
                (node_id, zone_id, predicted_at, horizon_hours, predicted_displacement_mm,
                 trend_direction, confidence, model_name, model_version)
            VALUES
                (:node_id, :zone_id, :predicted_at, :horizon_hours, :predicted_displacement_mm,
                 :trend_direction, :confidence, :model_name, :model_version)
            """
        ),
        {
            "node_id": node_id,
            "zone_id": zone_id,
            "predicted_at": predicted_at,
            "horizon_hours": regressor_result["horizon_hours"],
            "predicted_displacement_mm": regressor_result["predicted_displacement_mm"],
            "trend_direction": regressor_result["trend_direction"],
            "confidence": regressor_result["confidence"],
            "model_name": "xgboost_regressor",
            "model_version": regressor_result["model_version"],
        },
    )
    db.commit()
    return result.lastrowid


def update_risk_with_ml(db: Session, risk_id, classifier_result, if_result):
    ml_risk_class = classifier_result["ml_risk_class"] if classifier_result else None
    ml_probability = classifier_result["ml_probability"] if classifier_result else None
    anomaly_score = if_result["anomaly_score"] if if_result else None

    contributing_features = (
        classifier_result.get("top_contributing_features") if classifier_result else None
    )
    contributing_features_json = (
        json.dumps(contributing_features) if contributing_features is not None else None
    )

    db.execute(
        text(
            """
            UPDATE risks
            SET ml_risk_class = :ml_risk_class,
                ml_probability = :ml_probability,
                anomaly_score = :anomaly_score,
                contributing_features = :contributing_features
            WHERE id = :risk_id
            """
        ),
        {
            "ml_risk_class": ml_risk_class,
            "ml_probability": ml_probability,
            "anomaly_score": anomaly_score,
            "contributing_features": contributing_features_json,
            "risk_id": risk_id,
        },
    )
    db.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(BACKEND_DIR / ".env")

    from database.session import SessionLocal
    from ml.model_loader import initialize_model_registry
    from models.sensor_models import SensorReadingRaw, SensorReadingProcessed
    from models.risk_models import Risk

    db = SessionLocal()
    try:
        loaded, failed = initialize_model_registry(db)
        print("Loaded models:", list(loaded.keys()))
        if failed:
            print("Unavailable models (will be skipped gracefully):", failed)

        latest_processed = (
            db.query(SensorReadingProcessed)
            .order_by(SensorReadingProcessed.reading_timestamp.desc())
            .first()
        )

        if latest_processed is None:
            print("No sensor_readings_processed rows found in the database to test against.")
            sys.exit(0)

        latest_raw = (
            db.query(SensorReadingRaw)
            .filter(SensorReadingRaw.id == latest_processed.raw_reading_id)
            .one()
        )

        latest_risk = (
            db.query(Risk)
            .filter(Risk.node_id == latest_processed.node_id)
            .order_by(Risk.evaluated_at.desc())
            .first()
        )
        current_risk_level = latest_risk.risk_level if latest_risk else None

        from models.sensor_models import SensorNode

        node = db.query(SensorNode).filter(SensorNode.id == latest_raw.node_id).one()

        print(f"Testing inference on node_id={node.node_id} reading_timestamp={latest_raw.reading_timestamp}")
        print(f"Current rule-engine risk_level: {current_risk_level}")

        result = run_full_inference(latest_raw, latest_processed, current_risk_level)

        print("\nIsolation Forest:", result["isolation_forest"])
        print("\nXGBoost Classifier:", result["xgboost_classifier"])
        print("\nXGBoost Regressor:", result["xgboost_regressor"])
    finally:
        db.close()
