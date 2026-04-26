Param(
  [string]$PresenterWs = 'ws://10.250.250.1:5050',
  [string]$UserId = 'user-1',
  [string]$Seat = 'A1',
  [switch]$InstallPlaywrightBrowsers,
  [switch]$StartAfterSetup,
  [switch]$OpenWithPlaywrightGuide
)

$ErrorActionPreference = 'Stop'

Write-Host 'Installing user dependencies...'
npm install

if ($InstallPlaywrightBrowsers) {
  Write-Host 'Installing Playwright Chromium browser...'
  npx playwright install chromium
}

Write-Host 'User setup complete.'
Write-Host "Default presenter WS: $PresenterWs"
Write-Host "Start user host with: `$env:PRESENTER_WS='$PresenterWs'; npm run start"
Write-Host "Open user UI in Playwright with: `$env:PRESENTER_WS='$PresenterWs'; npm run start:playwright"
Write-Host "Run AWS blinking guide with: `$env:PRESENTER_WS='$PresenterWs'; npm run start:aws-guide"

if ($StartAfterSetup) {
  $env:PRESENTER_WS = $PresenterWs
  $env:USER_ID = $UserId
  $env:USER_SEAT = $Seat

  if ($OpenWithPlaywrightGuide) {
    npm run start:aws-guide
  } else {
    npm run start
  }
}
