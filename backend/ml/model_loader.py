import json
import logging
from pathlib import Path, PureWindowsPath
from threading import Lock

import joblib
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MODEL_NAMES = (
    "isolation_forest",
    "xgboost_classifier",
    "xgboost_regressor",
)


class ModelNotAvailableError(Exception):
    pass


def fetch_active_model_version(db: Session, model_name: str):
    row = db.execute(
        text(
            """
            SELECT
                model_name,
                version,
                file_path,
                trained_at,
                training_data_source,
                metrics
            FROM model_versions
            WHERE model_name = :model_name
              AND is_active = TRUE
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

        stored_path = str(version_row["file_path"])
        file_path = Path(stored_path)

        logger.info(
            "MODEL STORED PATH: model=%s, path=%s",
            model_name,
            stored_path,
        )

        # ---------------------------------------------------------
        # LOCAL / NORMAL PATH
        # ---------------------------------------------------------
        # If the stored path already exists on the current machine,
        # use it directly.
        if file_path.exists():
            logger.info(
                "MODEL PATH: using existing path for %s: %s",
                model_name,
                file_path,
            )

        else:
            # -----------------------------------------------------
            # RENDER / LINUX PATH
            # -----------------------------------------------------
            # The database contains the original Windows path, for
            # example:
            #
            # D:\python programs\mine-subsidence-system\models\
            # isolation_forest_v20260905_151537.pkl
            #
            # PureWindowsPath correctly extracts the filename even
            # when running on Linux.
            file_name = PureWindowsPath(stored_path).name

            # model_loader.py is:
            #
            # backend/ml/model_loader.py
            #
            # parents[1] = backend/
            backend_dir = Path(__file__).resolve().parents[1]

            # Render repository structure:
            #
            # backend/
            # ├── ml/
            # │   └── model_loader.py
            # └── ml_models/
            #     └── *.pkl
            model_path = backend_dir / "ml_models" / file_name

            logger.info(
                "MODEL PATH: model=%s, stored=%s, filename=%s, "
                "resolved=%s, exists=%s",
                model_name,
                stored_path,
                file_name,
                model_path,
                model_path.exists(),
            )

            if model_path.exists():
                file_path = model_path

        # ---------------------------------------------------------
        # FINAL EXISTENCE CHECK
        # ---------------------------------------------------------
        if not file_path.exists():
            raise ModelNotAvailableError(
                f"model_versions row for {model_name} points to a "
                f"missing file: {file_path}"
            )

        logger.info(
            "MODEL LOAD: loading %s version %s from %s",
            model_name,
            version_row["version"],
            file_path,
        )

        # ---------------------------------------------------------
        # LOAD MODEL
        # ---------------------------------------------------------
        artifact = joblib.load(file_path)

        # ---------------------------------------------------------
        # PARSE METRICS
        # ---------------------------------------------------------
        raw_metrics = version_row.get("metrics")

        if isinstance(raw_metrics, str):
            try:
                parsed_metrics = json.loads(raw_metrics)
            except (TypeError, ValueError):
                parsed_metrics = None
        else:
            parsed_metrics = raw_metrics

        # ---------------------------------------------------------
        # STORE MODEL IN REGISTRY
        # ---------------------------------------------------------
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
                logger.warning(
                    "Could not load model %s: %s",
                    model_name,
                    exc,
                )

                failed[model_name] = str(exc)

        return loaded, failed

    def get(self, model_name: str):
        with self._lock:
            artifact = self._artifacts.get(model_name)

        if artifact is None:
            raise ModelNotAvailableError(
                f"Model {model_name} is not currently loaded "
                f"in the registry"
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
            "Model registry initialized with %s of %s models loaded; "
            "missing: %s",
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
                f"  {model_name} -> "
                f"version {model_registry.get_version(model_name)}"
            )

        if failed:
            print("Failed to load:", failed)

    finally:
        db.close()