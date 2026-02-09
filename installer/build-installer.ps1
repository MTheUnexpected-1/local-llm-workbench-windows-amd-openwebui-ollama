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
