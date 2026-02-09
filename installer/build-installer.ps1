$ErrorActionPreference = "Stop"

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is not installed or not in PATH. $InstallHint"
    }
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [Parameter(Mandatory = $true)][string]$StepName,
        [string]$WorkingDirectory
    )

    Write-Host "[$StepName] Running: $FilePath $($ArgumentList -join ' ')"
    if ($WorkingDirectory) {
        Push-Location $WorkingDirectory
    }
    try {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "$StepName failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        if ($WorkingDirectory) {
            Pop-Location
        }
    }
}

Assert-Command -Name "npm" -InstallHint "Install Node.js 20+ from https://nodejs.org/"
Assert-Command -Name "wix" -InstallHint "Install WiX Toolset v4+ and ensure wix.exe is on PATH: https://wixtoolset.org/docs/intro/"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDir = Join-Path $repoRoot "app"
$distDir = Join-Path $repoRoot "dist"
$bundlePath = Join-Path $distDir "LocalLLMWorkbench-Setup.exe"
$releaseDir = Join-Path $appDir "release"
$unpackedDir = Join-Path $releaseDir "win-unpacked"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# Avoid common electron-builder lock failures.
Get-Process -Name "Local LLM Workbench" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

if (Test-Path $unpackedDir) {
    try {
        Remove-Item -Path $unpackedDir -Recurse -Force -ErrorAction Stop
    }
    catch {
        throw "Could not clean '$unpackedDir'. Close File Explorer/AV handles and rerun as admin. $_"
    }
}

Invoke-External -FilePath "npm" -ArgumentList @("install") -StepName "npm install" -WorkingDirectory $appDir
Invoke-External -FilePath "npm" -ArgumentList @("run", "package") -StepName "electron-builder package" -WorkingDirectory $appDir

Invoke-External -FilePath "wix" -ArgumentList @("build", ".\burn\Bundle.wxs", "-ext", "WixToolset.Bal.wixext", "-o", $bundlePath) -StepName "wix bundle build" -WorkingDirectory $PSScriptRoot

Write-Host "Build complete: $bundlePath"
Write-Host "Installer runtime logs: %APPDATA%\\LocalLLMWorkbench\\installer-logs\\install.log"
