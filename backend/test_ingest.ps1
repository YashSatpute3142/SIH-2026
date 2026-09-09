$apiKey = "67d0757591ef3a9423e9f959a7c899b2272d41527b3420d9da376cc4059eb191"

$payload = @{
    node_id = "NODE-A-01"
    zone_id = "A"
    data_source = "simulated"
    tilt_x = 1.2
    tilt_y = 0.8
    tilt_magnitude = 1.44
    displacement_mm = 3.5
    displacement_rate = 0.1
    vibration_rms = 0.05
    vibration_peak = 0.12
    vibration_variance = 0.01
    crack_width_mm = 0.0
    crack_detected = $false
    temperature = 24.5
    humidity = 60.0
    battery_voltage = 3.9
    rssi = -70
    packet_loss = 0.0
    sensor_status = "ok"
    calibration_status = "calibrated"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/ingest" -Method Post -Body $payload -ContentType "application/json" -Headers @{ "X-API-Key" = $apiKey }
