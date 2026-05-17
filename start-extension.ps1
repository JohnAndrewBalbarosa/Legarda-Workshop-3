# Launch a fresh Chrome window with the Workshop Guide extension loaded.
# Uses a separate user-data-dir so it doesn't conflict with your main Chrome.
$ErrorActionPreference = 'Stop'
$ext = Join-Path $PSScriptRoot 'extension'
$profile = Join-Path $env:LOCALAPPDATA 'WorkshopChromeProfile'
if (-not (Test-Path $profile)) { New-Item -ItemType Directory -Path $profile | Out-Null }

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Error 'Chrome not found. Install Google Chrome first.'; exit 1 }

Write-Host "Launching Chrome with extension at $ext"
& $chrome --user-data-dir="$profile" --load-extension="$ext" --no-first-run --no-default-browser-check 'https://aws.amazon.com/console/'
