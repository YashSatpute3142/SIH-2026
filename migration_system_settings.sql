-- Migration: add system_settings table
-- Run this against your existing local MySQL database (mine_subsidence_system).
-- Generic key-value settings store; first use is the Internet Offline toggle,
-- persisted so a server restart does not silently reset connectivity state.

USE mine_subsidence_system;

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('internet_online', 'true')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
