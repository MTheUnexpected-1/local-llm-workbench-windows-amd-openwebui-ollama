
$ErrorActionPreference = "Stop"

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "$Name is not installed or not in PATH. $InstallHint"
        exit 1
    }
}

Assert-Command -Name "npm" -InstallHint "Install Node.js 20+ from https://nodejs.org/"
Assert-Command -Name "wix" -InstallHint "Install WiX Toolset v4 and ensure 'wix.exe' is on PATH: https://wixtoolset.org/docs/intro/"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDir = Join-Path $repoRoot "app"
$distDir = Join-Path $repoRoot "dist"
$bundlePath = Join-Path $distDir "LocalLLMWorkbench-Setup.exe"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

Push-Location $appDir
npm install
npm run package
Pop-Location

Push-Location $PSScriptRoot
wix build .\burn\Bundle.wxs -o $bundlePath
Pop-Location

Write-Host "Build complete: $bundlePath"
Write-Host "Installer runtime logs: %APPDATA%\\LocalLLMWorkbench\\installer-logs\\install.log"
=======
# installer/build-installer.ps1
$ErrorActionPreference = "Stop"

# --- Config ---
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDir   = Join-Path $repoRoot "app"
$installerDir = $PSScriptRoot
$bundleWxs = Join-Path $installerDir "burn\Bundle.wxs"
$outExe   = Join-Path $repoRoot "dist\LocalLLMWorkbench-Setup.exe"

# WiX v6 install location (from your registry output)
$wixExe = "C:\Program Files\WiX Toolset v6.0\bin\wix.exe"

# --- Preflight ---
if (-not (Test-Path $wixExe)) {
  throw "WiX v6 CLI not found at: $wixExe`nInstall: winget install -e --id WiXToolset.WiXCLI"
}

if (-not (Test-Path $bundleWxs)) {
  throw "Bundle.wxs not found at: $bundleWxs"
}

# Ensure output folder exists
$distDir = Join-Path $repoRoot "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

Write-Host "Using WiX: $wixExe"
Write-Host "Bundle:   $bundleWxs"
Write-Host "Output:   $outExe"

# --- Build ---
Push-Location $installerDir
try {
  & $wixExe build ".\burn\Bundle.wxs" `
    -ext WixToolset.Bal.wixext `
    -ext WixToolset.Burn.wixext `
    -o "$outExe"
}
finally {
  Pop-Location
}

Write-Host "DONE: $outExe"

