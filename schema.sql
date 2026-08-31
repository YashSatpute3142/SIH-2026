-- mine-subsidence-system database schema
-- Engine: MySQL 8.x

CREATE DATABASE IF NOT EXISTS mine_subsidence_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mine_subsidence_system;

-- ==========================================================
-- USERS (extended for Google OAuth)
-- ==========================================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    picture_url VARCHAR(512),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================================
-- MINE PANELS
-- ==========================================================
CREATE TABLE mine_panels (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    panel_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    depth_m FLOAT,
    boundary_geojson JSON,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- ZONES
-- ==========================================================
CREATE TABLE zones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    zone_code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    panel_id BIGINT,
    boundary_geojson JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_zones_panel FOREIGN KEY (panel_id) REFERENCES mine_panels(id) ON DELETE SET NULL
);

CREATE INDEX idx_zones_panel_id ON zones(panel_id);

-- ==========================================================
-- SENSOR NODES
-- ==========================================================
CREATE TABLE sensor_nodes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL UNIQUE,
    zone_id BIGINT NOT NULL,
    data_source ENUM('real', 'simulated') NOT NULL DEFAULT 'simulated',
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    is_reference_node BOOLEAN NOT NULL DEFAULT FALSE,
    calibration_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    installed_at DATETIME,
    last_seen_at DATETIME,
    status VARCHAR(50) NOT NULL DEFAULT 'offline',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nodes_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT
);

CREATE INDEX idx_nodes_zone_id ON sensor_nodes(zone_id);
CREATE INDEX idx_nodes_data_source ON sensor_nodes(data_source);
CREATE INDEX idx_nodes_status ON sensor_nodes(status);

-- ==========================================================
-- SENSOR READINGS - RAW
-- ==========================================================
CREATE TABLE sensor_readings_raw (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT NOT NULL,
    zone_id BIGINT NOT NULL,
    reading_timestamp DATETIME NOT NULL,
    sequence_number BIGINT,
    data_source ENUM('real', 'simulated') NOT NULL,
    tilt_x FLOAT,
    tilt_y FLOAT,
    tilt_magnitude FLOAT,
    displacement_mm FLOAT,
    displacement_rate FLOAT,
    vibration_rms FLOAT,
    vibration_peak FLOAT,
    vibration_variance FLOAT,
    crack_width_mm FLOAT,
    crack_detected BOOLEAN,
    temperature FLOAT,
    humidity FLOAT,
    battery_voltage FLOAT,
    rssi INT,
    packet_loss FLOAT,
    sensor_status VARCHAR(50),
    calibration_status VARCHAR(50),
    ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_raw_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_raw_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT
);

CREATE INDEX idx_raw_timestamp ON sensor_readings_raw(reading_timestamp);
CREATE INDEX idx_raw_node_id ON sensor_readings_raw(node_id);
CREATE INDEX idx_raw_zone_id ON sensor_readings_raw(zone_id);
CREATE INDEX idx_raw_data_source ON sensor_readings_raw(data_source);

-- ==========================================================
-- SENSOR READINGS - PROCESSED
-- ==========================================================
CREATE TABLE sensor_readings_processed (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    raw_reading_id BIGINT NOT NULL,
    node_id BIGINT NOT NULL,
    zone_id BIGINT NOT NULL,
    reading_timestamp DATETIME NOT NULL,
    data_source ENUM('real', 'simulated') NOT NULL,
    tilt_rate FLOAT,
    displacement_rate_smoothed FLOAT,
    crack_growth_rate FLOAT,
    rolling_mean_displacement FLOAT,
    rolling_std_displacement FLOAT,
    vibration_energy FLOAT,
    neighbor_displacement_diff FLOAT,
    missing_packet_count INT DEFAULT 0,
    battery_trend FLOAT,
    rssi_trend FLOAT,
    data_quality_score FLOAT,
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_processed_raw FOREIGN KEY (raw_reading_id) REFERENCES sensor_readings_raw(id) ON DELETE CASCADE,
    CONSTRAINT fk_processed_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_processed_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT
);

CREATE INDEX idx_processed_timestamp ON sensor_readings_processed(reading_timestamp);
CREATE INDEX idx_processed_node_id ON sensor_readings_processed(node_id);
CREATE INDEX idx_processed_zone_id ON sensor_readings_processed(zone_id);

-- ==========================================================
-- ANOMALIES (Isolation Forest output)
-- ==========================================================
CREATE TABLE anomalies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT NOT NULL,
    zone_id BIGINT NOT NULL,
    processed_reading_id BIGINT,
    detected_at DATETIME NOT NULL,
    anomaly_score FLOAT NOT NULL,
    anomaly_status VARCHAR(20) NOT NULL,
    contributing_features JSON,
    model_version VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_anomalies_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_anomalies_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT,
    CONSTRAINT fk_anomalies_reading FOREIGN KEY (processed_reading_id) REFERENCES sensor_readings_processed(id) ON DELETE SET NULL
);

CREATE INDEX idx_anomalies_node_id ON anomalies(node_id);
CREATE INDEX idx_anomalies_zone_id ON anomalies(zone_id);
CREATE INDEX idx_anomalies_detected_at ON anomalies(detected_at);

-- ==========================================================
-- RISKS (fused final decision: rules + ML)
-- ==========================================================
CREATE TABLE risks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    zone_id BIGINT NOT NULL,
    node_id BIGINT,
    evaluated_at DATETIME NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    rule_triggered VARCHAR(255),
    ml_risk_class VARCHAR(20),
    ml_probability FLOAT,
    anomaly_score FLOAT,
    sensor_health_status VARCHAR(50),
    neighbor_agreement_count INT DEFAULT 0,
    persistence_seconds INT DEFAULT 0,
    data_quality_status VARCHAR(50),
    recommended_action TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_risks_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT,
    CONSTRAINT fk_risks_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE SET NULL
);

CREATE INDEX idx_risks_zone_id ON risks(zone_id);
CREATE INDEX idx_risks_node_id ON risks(node_id);
CREATE INDEX idx_risks_alert_level ON risks(risk_level);
CREATE INDEX idx_risks_evaluated_at ON risks(evaluated_at);

-- ==========================================================
-- PREDICTIONS (XGBoost regressor output)
-- ==========================================================
CREATE TABLE predictions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT NOT NULL,
    zone_id BIGINT NOT NULL,
    predicted_at DATETIME NOT NULL,
    horizon_hours INT NOT NULL,
    predicted_displacement_mm FLOAT NOT NULL,
    trend_direction VARCHAR(20),
    confidence FLOAT,
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_predictions_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_predictions_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT
);

CREATE INDEX idx_predictions_node_id ON predictions(node_id);
CREATE INDEX idx_predictions_zone_id ON predictions(zone_id);
CREATE INDEX idx_predictions_predicted_at ON predictions(predicted_at);

-- ==========================================================
-- ALERTS
-- ==========================================================
CREATE TABLE alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    risk_id BIGINT,
    zone_id BIGINT NOT NULL,
    alert_level VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    affected_nodes JSON,
    triggering_measurements JSON,
    model_probability FLOAT,
    anomaly_score FLOAT,
    data_quality_status VARCHAR(50),
    recommended_action TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    synchronization_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    CONSTRAINT fk_alerts_risk FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_zone FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE RESTRICT
);

CREATE INDEX idx_alerts_zone_id ON alerts(zone_id);
CREATE INDEX idx_alerts_alert_level ON alerts(alert_level);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_synchronization_status ON alerts(synchronization_status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- ==========================================================
-- ALERT ACKNOWLEDGEMENTS
-- ==========================================================
CREATE TABLE alert_acknowledgements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    acknowledged_by BIGINT NOT NULL,
    acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT fk_ack_alert FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ack_user FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_ack_alert_id ON alert_acknowledgements(alert_id);

-- ==========================================================
-- SYNC QUEUE (offline-first)
-- ==========================================================
CREATE TABLE sync_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    payload JSON NOT NULL,
    synchronization_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    last_attempt_at DATETIME,
    synced_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_synchronization_status ON sync_queue(synchronization_status);
CREATE INDEX idx_sync_entity ON sync_queue(entity_type, entity_id);

-- ==========================================================
-- MODEL VERSIONS
-- ==========================================================
CREATE TABLE model_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    trained_at DATETIME NOT NULL,
    training_data_source VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    metrics JSON,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_model_name_version (model_name, version)
);

CREATE INDEX idx_model_versions_name ON model_versions(model_name);

-- ==========================================================
-- AUDIT LOGS
-- ==========================================================
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    details JSON,
    ip_address VARCHAR(45),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- ==========================================================
-- SENSOR HEALTH EVENTS
-- ==========================================================
CREATE TABLE sensor_health_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSON,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_health_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_health_node_id ON sensor_health_events(node_id);
CREATE INDEX idx_health_occurred_at ON sensor_health_events(occurred_at);
