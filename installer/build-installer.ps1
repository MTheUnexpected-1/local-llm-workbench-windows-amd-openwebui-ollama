$ErrorActionPreference = "Stop"

# Kill running app to prevent EBUSY lock
Get-Process "Local LLM Workbench" -ErrorAction SilentlyContinue | Stop-Process -Force

Push-Location "$PSScriptRoot\..\app"
npm install
npm run package
Pop-Location

Push-Location $PSScriptRoot
& "$PSScriptRoot\..\app\node_modules\.bin\wix.cmd" build .\burn\Bundle.wxs -o ..\dist\LocalLLMWorkbench-Setup.exe
Pop-Location
Write-Host "Created dist\\LocalLLMWorkbench-Setup.exe"
