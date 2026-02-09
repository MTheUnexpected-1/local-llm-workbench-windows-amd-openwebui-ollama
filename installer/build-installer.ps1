# installer/build-bundle.ps1
$ErrorActionPreference = "Stop"

# --- Helpers ---
function Confirm-DotnetTool {
  param(
    [string]$Name,
    [string]$Version
  )
  # ...existing code...
}

function Get-RemoteFile {
  param(
    [string]$Url,
    [string]$OutFile,
    [string]$ExpectedHash
  )
  # ...existing code...
}

# --- Prereq URLs ---
$DockerUrl   = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
$VCRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

# --- Paths ---
$installerDir = $PSScriptRoot
$burnDir      = Join-Path $installerDir "burn"
$varsInclude  = Join-Path $burnDir "_payload-vars.wxi"
$distDir      = Join-Path $installerDir "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

# --- Download + hash (SHA-512) ---
$tmp = Join-Path $env:TEMP "llmwb-payloads"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$dockerPath   = Join-Path $tmp "DockerDesktopInstaller.exe"
$vcredistPath = Join-Path $tmp "vc_redist.x64.exe"

curl.exe -L $DockerUrl   -o $dockerPath
curl.exe -L $VCRedistUrl -o $vcredistPath

$DockerHash   = (Get-FileHash $dockerPath   -Algorithm SHA512).Hash.ToLower()
$VCRedistHash = (Get-FileHash $vcredistPath -Algorithm SHA512).Hash.ToLower()

# --- Emit include used by Bundle.wxs ---
@"
<?xml version="1.0" encoding="utf-8"?>
<Include xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <?define DockerDownloadUrl="$DockerUrl" ?>
  <?define VCRedistDownloadUrl="$VCRedistUrl" ?>
  <?define DockerHash="$DockerHash" ?>
  <?define VCRedistHash="$VCRedistHash" ?>
</Include>
"@ | Set-Content -Encoding UTF8 $varsInclude

# --- Build bundle EXE (WiX v6 local tool) ---
dotnet tool run wix build `
  (Join-Path $burnDir "Bundle.wxs") `
  -ext WixToolset.BootstrapperApplications.wixext `
  -o (Join-Path $distDir "LocalLLMWorkbench-Setup.exe")

Write-Host "`nBuilt: $distDir\LocalLLMWorkbench-Setup.exe"
