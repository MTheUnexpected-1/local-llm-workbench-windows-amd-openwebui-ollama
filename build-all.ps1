param()

$ErrorActionPreference = "Stop"
$rootDir = "d:\User\Documents\GitHub\local-llm-workbench-windows-amd-openwebui-ollama"
$appDir = Join-Path $rootDir "app"
$installerDir = Join-Path $rootDir "installer"
$burnDir = Join-Path $installerDir "burn"
$releaseDir = Join-Path $rootDir "release"
$appReleaseDir = Join-Path $appDir "release"

# Clean up old release directories
Write-Host "Cleaning up old build artifacts..." -ForegroundColor Yellow
if (Test-Path $appReleaseDir) {
    Remove-Item -Path $appReleaseDir -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

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

# Calculate hashes for payloads
Write-Host "Step 2b: Calculating payload hashes..." -ForegroundColor Yellow
$DockerUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
$VCRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

$tempDir = Join-Path $env:TEMP "llmwb-payloads"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$dockerPath = Join-Path $tempDir "DockerDesktopInstaller.exe"
$vcredistPath = Join-Path $tempDir "vc_redist.x64.exe"

# Check if Docker is already installed
function Test-DockerInstalled {
    $candidates = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe"
    )
    return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

# Check if VC Redist is already installed
function Test-VCRedistInstalled {
    $vcRedistKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $installed = Get-ChildItem $vcRedistKey | ForEach-Object {
        $name = (Get-ItemProperty -Path $_.PSPath).DisplayName
        if ($name -like "*Visual C++*Redistributable*" -and $name -like "*x64*") {
            return $true
        }
    }
    return $false
}

$dockerInstalled = Test-DockerInstalled
$vcRedistInstalled = Test-VCRedistInstalled

Write-Host "Checking installed software..." -ForegroundColor Yellow
if ($dockerInstalled) {
    Write-Host "✓ Docker Desktop is already installed" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Desktop not found, will need to download" -ForegroundColor Yellow
}

if ($vcRedistInstalled) {
    Write-Host "✓ Visual C++ Redistributable is already installed" -ForegroundColor Green
} else {
    Write-Host "✗ Visual C++ Redistributable not found, will need to download" -ForegroundColor Yellow
}

# Download Docker if not installed
if (-not $dockerInstalled) {
    Write-Host "`nRemoving cached Docker installer to force fresh download..." -ForegroundColor Yellow
    if (Test-Path $dockerPath) { Remove-Item -Path $dockerPath -Force }
    
    Write-Host "Downloading Docker Desktop..." -ForegroundColor Cyan
    curl.exe -L $DockerUrl -o $dockerPath --progress-bar
} else {
    Write-Host "Skipping Docker Desktop download (already installed)" -ForegroundColor Green
}

# Download VC Redist if not installed
if (-not $vcRedistInstalled) {
    Write-Host "`nRemoving cached VC Redist installer to force fresh download..." -ForegroundColor Yellow
    if (Test-Path $vcredistPath) { Remove-Item -Path $vcredistPath -Force }
    
    Write-Host "Downloading VC Redist..." -ForegroundColor Cyan
    curl.exe -L $VCRedistUrl -o $vcredistPath --progress-bar
} else {
    Write-Host "Skipping VC Redist download (already installed)" -ForegroundColor Green
}

# Calculate SHA-512 hashes (even for installed, for bundle configuration)
Write-Host "`nComputing hashes..." -ForegroundColor Yellow
$DockerHash = if (Test-Path $dockerPath) {
    (Get-FileHash -Path $dockerPath -Algorithm SHA512).Hash.ToLower()
} else {
    # Use placeholder for installed Docker
    "0000000000000000000000000000000000000000000000000000000000000000"
}

$VCRedistHash = if (Test-Path $vcredistPath) {
    (Get-FileHash -Path $vcredistPath -Algorithm SHA512).Hash.ToLower()
} else {
    # Use placeholder for installed VC Redist
    "0000000000000000000000000000000000000000000000000000000000000000"
}

$DockerSize = if (Test-Path $dockerPath) { (Get-Item $dockerPath).Length } else { 0 }
$VCRedistSize = if (Test-Path $vcredistPath) { (Get-Item $vcredistPath).Length } else { 0 }

if ($DockerSize -gt 0) {
    Write-Host "Docker Desktop hash: $DockerHash" -ForegroundColor Cyan
    Write-Host "Docker Desktop size: $DockerSize bytes" -ForegroundColor Cyan
}

if ($VCRedistSize -gt 0) {
    Write-Host "VC Redist hash: $VCRedistHash" -ForegroundColor Cyan
    Write-Host "VC Redist size: $VCRedistSize bytes" -ForegroundColor Cyan
}

# Build installer with correct hashes
Write-Host "Step 3: Building installer..." -ForegroundColor Yellow
$wixExe = "C:\Program Files\WiX Toolset v6.0\bin\wix.exe"
Push-Location $burnDir
$bundlePath = Join-Path $releaseDir "LocalLLMWorkbench-Setup.exe"
& $wixExe build .\Bundle.wxs -ext WixToolset.BootstrapperApplications.wixext -d DockerDownloadUrl=$DockerUrl -d DockerSize=$DockerSize -d DockerHash=$DockerHash -d VCRedistDownloadUrl=$VCRedistUrl -d VCRedistSize=$VCRedistSize -d VCRedistHash=$VCRedistHash -o $bundlePath
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
