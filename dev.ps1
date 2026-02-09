$ErrorActionPreference = "Stop"
Push-Location .\app
npm install
npm run build
Start-Process npm -ArgumentList "run dev"
Pop-Location

Copy-Item .\stack\.env.example .\stack\.env -Force
docker compose --env-file .\stack\.env -f .\stack\docker-compose.yml up -d --build
Write-Host "Dev stack started. Launch Local LLM Workbench app from Electron window."
