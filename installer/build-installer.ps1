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
