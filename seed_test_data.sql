USE mine_subsidence_system;

INSERT INTO mine_panels (panel_code, name, depth_m, status)
VALUES ('PANEL-01', 'Test Panel 1', 120.5, 'active');

INSERT INTO zones (zone_code, name, panel_id)
VALUES ('A', 'Zone A', (SELECT id FROM mine_panels WHERE panel_code = 'PANEL-01'));

INSERT INTO sensor_nodes (node_id, zone_id, data_source, latitude, longitude, is_reference_node, calibration_status, status)
VALUES (
    'NODE-A-01',
    (SELECT id FROM zones WHERE zone_code = 'A'),
    'simulated',
    23.259933,
    77.412615,
    FALSE,
    'calibrated',
    'offline'
);
