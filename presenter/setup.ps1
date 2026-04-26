Param(
  [switch]$StartAfterSetup,
  [switch]$OpenWithPlaywright
)

$ErrorActionPreference = 'Stop'

Write-Host 'Installing presenter dependencies...'
npm install

Write-Host 'Presenter setup complete.'
Write-Host 'Start presenter server with: npm run start'
Write-Host 'Open presenter in Playwright with: npm run start:playwright'

if ($StartAfterSetup) {
  if ($OpenWithPlaywright) {
    npm run start:playwright
  } else {
    npm run start
  }
}
