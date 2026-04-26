# AWS Workshop Troubleshooting & Reset Script
Write-Host "--- Resetting AWS Workshop Environment ---" -ForegroundColor Cyan

# 1. Kill all related processes
Write-Host "Stopping existing processes..."
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*presenter*" -or $_.CommandLine -like "*user*" -or $_.CommandLine -like "*usher*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Release Playwright session locks
Write-Host "Cleaning session locks..."
Remove-Item -Path "user/.aws-session/SingletonLock" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "user/.aws-session/lock" -Force -ErrorAction SilentlyContinue

# 3. Detect LAN IP
$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPv4Address -notlike "169.*" } | Select-Object -ExpandProperty IPv4Address | Select-Object -First 1
Write-Host "Detected LAN IP: $ip" -ForegroundColor Green

# 4. Restart Services
$env:PRESENTER_HOST="$ip"
$env:HOST="$ip"
$env:PRESENTER_WS="ws://$($ip):5050"

Write-Host "Starting Usher, Presenter, and User Side..." -ForegroundColor Yellow
Start-Process node -ArgumentList "usher/server.js" -NoNewWindow
Start-Process node -ArgumentList "presenter/selfhost-playwright.mjs" -NoNewWindow
Start-Process node -ArgumentList "user/aws-guide-playwright.mjs" -NoNewWindow

Write-Host "Done! Please wait a few seconds for the windows to appear." -ForegroundColor Green
