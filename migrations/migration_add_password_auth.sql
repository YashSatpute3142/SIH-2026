USE mine_subsidence_system;

ALTER TABLE users
    MODIFY google_id VARCHAR(255) NULL,
    ADD COLUMN password_hash VARCHAR(255) NULL AFTER google_id,
    ADD COLUMN auth_provider ENUM('google', 'password') NOT NULL DEFAULT 'password' AFTER password_hash;
