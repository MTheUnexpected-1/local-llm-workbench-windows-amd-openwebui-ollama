. "$PSScriptRoot\common.ps1"
Add-Type -AssemblyName PresentationFramework

Initialize-InstallerLogging
Write-InstallerLog "Running Docker Desktop preflight checks."

$dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
$dockerCliPath = "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"

if (-not (Test-Path $dockerDesktopPath)) {
    Write-InstallerLog "Docker Desktop is missing. Prompting user with official download URL."
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

Write-InstallerLog "Docker Desktop executable found: $dockerDesktopPath"

if (-not (Test-Path $dockerCliPath)) {
    throw "Docker CLI not found at expected path: $dockerCliPath"
}

$dockerInfo = & $dockerCliPath info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-InstallerLog "Docker Desktop appears installed but engine is not running."
    [System.Windows.MessageBox]::Show(
        "Docker Desktop is installed but not running. Start Docker Desktop, wait until engine is ready, then click OK to continue.",
        "Start Docker Desktop",
        "OK",
        "Information"
    ) | Out-Null

    $dockerInfo = & $dockerCliPath info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-InstallerLog "Docker info still failing after prompt: $dockerInfo"
        throw "Docker Desktop is not running. Start Docker Desktop and rerun setup."
    }
}

Write-InstallerLog "Docker engine is running and ready."
Write-InstallerLog "Preflight checks complete."
