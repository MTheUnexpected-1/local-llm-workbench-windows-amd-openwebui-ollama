Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [ValidateSet("preflight", "ux", "stack")]
    [string]$Phase = "preflight"
)

$InstallerLogDir = Join-Path $env:APPDATA "LocalLLMWorkbench\installer-logs"
$InstallerLogFile = Join-Path $InstallerLogDir "install.log"

function Ensure-Dir {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-InstallerLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    Ensure-Dir -Path $InstallerLogDir
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$ts][$Phase] $Message"
    Write-Host $line
    Add-Content -Path $InstallerLogFile -Value $line
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

function Run-Preflight {
    Add-Type -AssemblyName PresentationFramework

    Write-InstallerLog "Running Docker Desktop preflight checks."
    $dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    $dockerCliPath = "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"

    if (-not (Test-Path $dockerDesktopPath)) {
        Write-InstallerLog "Docker Desktop missing. Showing official download prompt."
        $msg = @"
Docker Desktop is required to run Local LLM Workbench.

Click Yes to open the official Docker Desktop download page.
Click No to cancel installation now.

URL:
https://www.docker.com/products/docker-desktop/
"@
        $result = [System.Windows.MessageBox]::Show($msg, "Docker Desktop Required", "YesNo", "Warning")
        if ($result -eq [System.Windows.MessageBoxResult]::Yes) {
            Start-Process "https://www.docker.com/products/docker-desktop/"
            Write-InstallerLog "Opened Docker Desktop official download URL in browser."
        }
        throw "Docker Desktop not installed. Install Docker Desktop and rerun setup."
    }

    if (-not (Test-Path $dockerCliPath)) {
        throw "Docker CLI not found at expected path: $dockerCliPath"
    }

    $dockerInfo = & $dockerCliPath info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-InstallerLog "Docker installed but engine not running. Prompting user to start Docker Desktop."
        [System.Windows.MessageBox]::Show(
            "Docker Desktop is installed but not running. Start Docker Desktop, wait until engine is ready, then click OK to continue.",
            "Start Docker Desktop",
            "OK",
            "Information"
        ) | Out-Null

        $dockerInfo = & $dockerCliPath info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-InstallerLog "Docker info still failing: $dockerInfo"
            throw "Docker Desktop is not running. Start Docker Desktop and rerun setup."
        }
    }

    Write-InstallerLog "Preflight checks complete."
}

function Run-UxProgress {
    Write-InstallerLog "Preparing grouped install progress messages."

    $installRoot = Join-Path ${env:ProgramFiles} "Local LLM Workbench"
    $steps = @(
      "Extracting bootstrapper payloads",
      "Installing Visual C++ Redistributable",
      "Installing Local LLM Workbench MSI",
      "Registering shortcuts and shell entries",
      "Finalizing setup"
    )

    $representativeFiles = @(
      "Local LLM Workbench.exe",
      "resources\\app.asar",
      "resources\\elevate.exe",
      "locales\\en-US.pak",
      "chrome_100_percent.pak"
    )

    foreach ($step in $steps) {
      Write-InstallerLog "[STATUS] $step"
      Start-Sleep -Milliseconds 300
    }

    foreach ($f in $representativeFiles) {
      $dest = Join-Path $installRoot $f
      Write-InstallerLog "[FILE] Copying $f -> $dest"
      Start-Sleep -Milliseconds 120
    }

    Write-InstallerLog "Grouped progress output complete."
}

function Run-StackValidation {
    Write-InstallerLog "Starting post-install stack validation and image pull."

    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
    $composeFile = Join-Path $repoRoot "stack\docker-compose.yml"
    $envFile = Join-Path $repoRoot "stack\.env.example"

    if (-not (Test-Path $composeFile)) {
        throw "Compose file missing: $composeFile"
    }
    if (-not (Test-Path $envFile)) {
        throw "Env example missing: $envFile"
    }

    Invoke-LoggedCommand -FilePath "docker" -ArgumentList @("pull", "ollama/ollama:latest") -StepName "Pull ollama"
    Invoke-LoggedCommand -FilePath "docker" -ArgumentList @("pull", "ghcr.io/open-webui/open-webui:main") -StepName "Pull openwebui"
    Invoke-LoggedCommand -FilePath "docker" -ArgumentList @("compose", "--env-file", $envFile, "-f", $composeFile, "pull") -StepName "Compose pull"
    Invoke-LoggedCommand -FilePath "docker" -ArgumentList @("compose", "--env-file", $envFile, "-f", $composeFile, "up", "-d", "--build") -StepName "Test stack up"

    $psOutput = & docker compose --env-file $envFile -f $composeFile ps 2>&1
    Write-InstallerLog "Compose ps:`n$psOutput"
    Write-InstallerLog "Stack validation complete."
}

Write-InstallerLog "--- Installer phase start ---"
switch ($Phase) {
    "preflight" { Run-Preflight }
    "ux" { Run-UxProgress }
    "stack" { Run-StackValidation }
}
Write-InstallerLog "--- Installer phase end ---"
