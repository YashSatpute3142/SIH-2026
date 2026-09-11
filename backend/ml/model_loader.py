import json
import logging
from pathlib import Path
from threading import Lock

import joblib
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MODEL_NAMES = ("isolation_forest", "xgboost_classifier", "xgboost_regressor")


class ModelNotAvailableError(Exception):
    pass


def fetch_active_model_version(db: Session, model_name: str):
    row = db.execute(
        text(
            """
            SELECT model_name, version, file_path, trained_at, training_data_source, metrics
            FROM model_versions
            WHERE model_name = :model_name AND is_active = TRUE
            ORDER BY trained_at DESC
            LIMIT 1
            """
        ),
        {"model_name": model_name},
    ).mappings().first()

    if row is None:
        raise ModelNotAvailableError(
            f"No active model_versions row found for model_name={model_name}"
        )

    return dict(row)


class ModelRegistry:
    def __init__(self):
        self._lock = Lock()
        self._artifacts = {}
        self._versions = {}
        self._metrics = {}

    def load_model(self, db: Session, model_name: str):
        version_row = fetch_active_model_version(db, model_name)

        file_path = Path(version_row["file_path"])

        # Keep existing local absolute paths working.
        # If the stored path does not exist (e.g. Render),
        # resolve the model relative to the project root.
        if not file_path.exists():
            project_root = Path(__file__).resolve().parents[2]

            file_name = file_path.name
            model_path = project_root / "models" / file_name

            if model_path.exists():
                file_path = model_path

        if not file_path.exists():
            raise ModelNotAvailableError(
                f"model_versions row for {model_name} points to a missing file: {file_path}"
            )

        artifact = joblib.load(file_path)

        raw_metrics = version_row.get("metrics")
        if isinstance(raw_metrics, str):
            try:
                parsed_metrics = json.loads(raw_metrics)
            except (TypeError, ValueError):
                parsed_metrics = None
        else:
            parsed_metrics = raw_metrics

        with self._lock:
            self._artifacts[model_name] = artifact
            self._versions[model_name] = version_row["version"]
            self._metrics[model_name] = parsed_metrics

        logger.info(
            "Loaded model %s version %s from %s",
            model_name,
            version_row["version"],
            file_path,
        )
        return artifact

    def load_all(self, db: Session):
        loaded = {}
        failed = {}

        for model_name in MODEL_NAMES:
            try:
                loaded[model_name] = self.load_model(db, model_name)
            except ModelNotAvailableError as exc:
                logger.warning("Could not load model %s: %s", model_name, exc)
                failed[model_name] = str(exc)

        return loaded, failed

    def get(self, model_name: str):
        with self._lock:
            artifact = self._artifacts.get(model_name)

        if artifact is None:
            raise ModelNotAvailableError(
                f"Model {model_name} is not currently loaded in the registry"
            )

        return artifact

    def is_loaded(self, model_name: str) -> bool:
        with self._lock:
            return model_name in self._artifacts

    def get_version(self, model_name: str):
        with self._lock:
            return self._versions.get(model_name)

    def get_metrics(self, model_name: str):
        with self._lock:
            return self._metrics.get(model_name)

    def loaded_model_names(self):
        with self._lock:
            return list(self._artifacts.keys())


model_registry = ModelRegistry()


def initialize_model_registry(db: Session):
    loaded, failed = model_registry.load_all(db)

    if failed:
        logger.warning(
            "Model registry initialized with %s of %s models loaded; missing: %s",
            len(loaded),
            len(MODEL_NAMES),
            list(failed.keys()),
        )
    else:
        logger.info(
            "Model registry initialized with all %s models loaded",
            len(loaded),
        )

    return loaded, failed


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    BACKEND_DIR = Path(__file__).resolve().parents[1]
    PROJECT_ROOT = BACKEND_DIR.parent
    sys.path.insert(0, str(BACKEND_DIR))

    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(BACKEND_DIR / ".env")

    from database.session import SessionLocal

    db = SessionLocal()

    try:
        loaded, failed = initialize_model_registry(db)

        print("Loaded models:", list(loaded.keys()))

        for model_name in loaded:
            print(
                f"  {model_name} -> version {model_registry.get_version(model_name)}"
            )

        if failed:
            print("Failed to load:", failed)

    finally:
        db.close()