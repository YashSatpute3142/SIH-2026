$body = @{ email = "demo.tester@example.com"; password = "DemoPassword123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n--- /api/nodes/NODE-A-01/influence-zone ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/nodes/NODE-A-01/influence-zone" -Headers $headers | ConvertTo-Json -Depth 5

Write-Host "`n--- /api/influence-zones (bulk) ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/influence-zones" -Headers $headers | ConvertTo-Json -Depth 5
