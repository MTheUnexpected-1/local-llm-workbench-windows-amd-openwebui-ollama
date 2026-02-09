$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\..\app"
npm install
npm run package
Pop-Location

Push-Location $PSScriptRoot
wix build .\burn\Bundle.wxs -o ..\dist\LocalLLMWorkbench-Setup.exe
Pop-Location
Write-Host "Created dist\\LocalLLMWorkbench-Setup.exe"
