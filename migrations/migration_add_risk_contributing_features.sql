-- Migration: add contributing_features column to risks table
-- Run this against your existing local MySQL database (mine_subsidence_system).
-- Persists the XGBoost classifier's top feature contributions (already computed
-- in ml/inference.py's run_xgboost_classifier, but previously discarded) so the
-- AI Explanation panel can read them back per risk evaluation instead of them
-- only existing transiently at ingest time.

USE mine_subsidence_system;

ALTER TABLE risks
    ADD COLUMN contributing_features JSON NULL AFTER anomaly_score;
