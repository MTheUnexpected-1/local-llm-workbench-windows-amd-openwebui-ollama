Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Global:InstallerLogDir = Join-Path $env:APPDATA "LocalLLMWorkbench\installer-logs"
$Global:InstallerLogFile = Join-Path $Global:InstallerLogDir "install.log"

function Initialize-InstallerLogging {
    if (-not (Test-Path $Global:InstallerLogDir)) {
        New-Item -ItemType Directory -Path $Global:InstallerLogDir -Force | Out-Null
    }
    Write-InstallerLog "--- Installer step started ---"
}

function Write-InstallerLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$ts] $Message"
    Write-Host $line
    Add-Content -Path $Global:InstallerLogFile -Value $line
}

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [string]$StepName = "Command"
    )

    Write-InstallerLog "$StepName | Command: $FilePath $($ArgumentList -join ' ')"
    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -PassThru -NoNewWindow -Wait
    Write-InstallerLog "$StepName | ExitCode: $($process.ExitCode)"

    if ($process.ExitCode -ne 0) {
        throw "$StepName failed with exit code $($process.ExitCode)"
    }
}
