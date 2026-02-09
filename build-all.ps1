param()

$ErrorActionPreference = "Stop"
$rootDir = "d:\User\Documents\GitHub\local-llm-workbench-windows-amd-openwebui-ollama"
$appDir = Join-Path $rootDir "app"
$installerDir = Join-Path $rootDir "installer"
$burnDir = Join-Path $installerDir "burn"
$releaseDir = Join-Path $rootDir "release"

if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }

Write-Host "Building Local LLM Workbench..." -ForegroundColor Cyan

# Build app
Write-Host "Step 1: Building app..." -ForegroundColor Yellow
Push-Location $appDir
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location

# Package MSI
Write-Host "Step 2: Packaging MSI..." -ForegroundColor Yellow
Push-Location $appDir
npm run package
if ($LASTEXITCODE -ne 0) { exit 1 }
Pop-Location

# Build installer
Write-Host "Step 3: Building installer..." -ForegroundColor Yellow
$wixExe = "C:\Program Files\WiX Toolset v6.0\bin\wix.exe"
Push-Location $burnDir
$bundlePath = Join-Path $releaseDir "LocalLLMWorkbench-Setup.exe"
& $wixExe build .\Bundle.wxs -ext WixToolset.BootstrapperApplications.wixext -d DockerDownloadUrl=https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe -d DockerSize=627871152 -d VCRedistDownloadUrl=https://aka.ms/vs/17/release/vc_redist.x64.exe -d VCRedistSize=25635768 -o $bundlePath
Pop-Location

# Verify
if (Test-Path $bundlePath) {
    $fileSize = (Get-Item $bundlePath).Length / 1MB
    Write-Host "Build complete! Size: $([Math]::Round($fileSize, 2)) MB" -ForegroundColor Green
    Write-Host "Installer: $bundlePath" -ForegroundColor Cyan
} else {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}
