-- Migration: add node_name and sensor_types columns to sensor_nodes
-- Run this against your existing local MySQL database (mine_subsidence_system).
-- Supports dynamic node registration (Chat 8): a human-readable display name
-- and a declared list of physical sensor types installed on the node.
-- Both nullable — existing rows (e.g. NODE-A-01) are unaffected until edited
-- via the new registration/edit UI.

USE mine_subsidence_system;

ALTER TABLE sensor_nodes
    ADD COLUMN node_name VARCHAR(255) NULL AFTER node_id,
    ADD COLUMN sensor_types JSON NULL AFTER data_source;
