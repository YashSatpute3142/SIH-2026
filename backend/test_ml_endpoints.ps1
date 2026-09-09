$body = @{ email = "demo.tester@example.com"; password = "DemoPassword123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n--- /api/anomalies ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/anomalies" -Headers $headers | ConvertTo-Json

Write-Host "`n--- /api/nodes/NODE-A-01/anomalies/latest ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/nodes/NODE-A-01/anomalies/latest" -Headers $headers | ConvertTo-Json

Write-Host "`n--- /api/predictions ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/predictions" -Headers $headers | ConvertTo-Json

Write-Host "`n--- /api/nodes/NODE-A-01/predictions/latest ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/nodes/NODE-A-01/predictions/latest" -Headers $headers | ConvertTo-Json
