# install-prerequisites-and-app.ps1
# ─────────────────────────────────────────────────────────────
# Downloads + installs Docker Desktop and VC++ Redistributable
# then launches the main WiX installer
# ─────────────────────────────────────────────────────────────

Write-Host "=== Local LLM Workbench Installer Helper ===" -ForegroundColor Cyan
Write-Host "This script will:" -ForegroundColor White
Write-Host "  1. Download and install Docker Desktop (if missing)"
Write-Host "  2. Download and install Visual C++ Redistributable (if missing)"
Write-Host "  3. Launch the main installer (you will see the license there)"
Write-Host ""

# ─── Docker Desktop ─────────────────────────────────────────────
Write-Host "Checking for Docker Desktop..." -ForegroundColor Cyan

if (-not (Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe")) {
    Write-Host "Downloading Docker Desktop..." -ForegroundColor Green
    $dockerUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
    $dockerTemp = "$env:TEMP\DockerDesktopInstaller.exe"

    try {
        Invoke-WebRequest -Uri $dockerUrl -OutFile $dockerTemp -UseBasicParsing
        Write-Host "Installing Docker Desktop – follow the prompts if any..." -ForegroundColor Green
        Start-Process -FilePath $dockerTemp -ArgumentList "install --accept-license" -Wait
        Remove-Item $dockerTemp -Force -ErrorAction SilentlyContinue
        Write-Host "Docker Desktop installed." -ForegroundColor Green
    } catch {
        Write-Host "Failed to install Docker Desktop: $_" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "Docker Desktop is already installed." -ForegroundColor Green
}


# ─── Visual C++ Redistributable ─────────────────────────────────
Write-Host ""
Write-Host "Checking for Visual C++ Redistributable..." -ForegroundColor Cyan

$vcKey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
if (-not $vcKey) {
    Write-Host "Downloading Visual C++ Redistributable..." -ForegroundColor Green
    $vcUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    $vcTemp = "$env:TEMP\vc_redist.x64.exe"

    try {
        Invoke-WebRequest -Uri $vcUrl -OutFile $vcTemp -UseBasicParsing
        Write-Host "Installing Visual C++ Redistributable..." -ForegroundColor Green
        Start-Process -FilePath $vcTemp -ArgumentList "/install /norestart" -Wait
        Remove-Item $vcTemp -Force -ErrorAction SilentlyContinue
        Write-Host "Visual C++ Redistributable installed." -ForegroundColor Green
    } catch {
        Write-Host "Failed to install VC++ Redistributable: $_" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "Visual C++ Redistributable is already installed." -ForegroundColor Green
}


# ─── Launch main installer ──────────────────────────────────────
Write-Host ""
Write-Host "All prerequisites are ready." -ForegroundColor Cyan
Write-Host "Starting the main installer now..." -ForegroundColor Green
Write-Host "You will see the license agreement here." -ForegroundColor Yellow
Write-Host ""

$installer = ".\LocalLLMWorkbench-Setup.exe"

if (Test-Path $installer) {
    Start-Process -FilePath $installer -Wait
    Write-Host ""
    Write-Host "Installation completed." -ForegroundColor Green
} else {
    Write-Host "ERROR: Cannot find $installer in this folder." -ForegroundColor Red
    Write-Host "Please make sure the installer file is present." -ForegroundColor Red
    pause
}