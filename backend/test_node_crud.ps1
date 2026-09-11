$body = @{ email = "demo.tester@example.com"; password = "DemoPassword123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $login.token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

Write-Host "`n--- Create node ---"
$newNode = @{
    node_id = "NODE-TEST-01"
    node_name = "Test Node One"
    zone_id = 1
    data_source = "simulated"
    sensor_types = @("tilt", "displacement", "vibration")
    latitude = 23.261
    longitude = 77.414
} | ConvertTo-Json

$created = Invoke-RestMethod -Uri "http://localhost:8000/api/nodes" -Method Post -Body $newNode -Headers $headers
$created | ConvertTo-Json

Write-Host "`n--- Confirm it shows up in GET /api/nodes ---"
$allNodes = Invoke-RestMethod -Uri "http://localhost:8000/api/nodes" -Headers $headers
$allNodes | Where-Object { $_.node_id -eq "NODE-TEST-01" } | ConvertTo-Json

Write-Host "`n--- Update node (rename + move) ---"
$updatePayload = @{
    node_name = "Test Node One (Renamed)"
    latitude = 23.262
} | ConvertTo-Json

$updated = Invoke-RestMethod -Uri "http://localhost:8000/api/nodes/NODE-TEST-01" -Method Patch -Body $updatePayload -Headers $headers
$updated | ConvertTo-Json

Write-Host "`n--- Deregister node ---"
$deregistered = Invoke-RestMethod -Uri "http://localhost:8000/api/nodes/NODE-TEST-01" -Method Delete -Headers $headers
$deregistered | ConvertTo-Json

Write-Host "`n--- Try creating duplicate node_id (expect 409) ---"
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/nodes" -Method Post -Body $newNode -Headers $headers
} catch {
    Write-Host "Expected error:" $_.Exception.Response.StatusCode.value__
}
