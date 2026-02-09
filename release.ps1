$ErrorActionPreference = "Stop"
Push-Location .\app
npm install
npm run package
Pop-Location

.\installer\build-installer.ps1
