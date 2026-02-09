. "$PSScriptRoot\common.ps1"

Initialize-InstallerLogging
Write-InstallerLog "Installer UX step: preparing grouped file/component progress output."

$installRoot = Join-Path ${env:ProgramFiles} "Local LLM Workbench"
$representativeFiles = @(
  "Local LLM Workbench.exe",
  "resources\\app.asar",
  "resources\\elevate.exe",
  "locales\\en-US.pak",
  "chrome_100_percent.pak"
)

$steps = @(
  "Extracting bootstrapper payloads",
  "Installing Visual C++ Redistributable",
  "Installing Local LLM Workbench MSI",
  "Registering shortcuts and shell entries",
  "Finalizing setup"
)

foreach ($step in $steps) {
  Write-InstallerLog "[STATUS] $step"
  Start-Sleep -Milliseconds 350
}

foreach ($f in $representativeFiles) {
  $dest = Join-Path $installRoot $f
  Write-InstallerLog "[FILE] Copying $f -> $dest"
  Start-Sleep -Milliseconds 150
}

Write-InstallerLog "Installer UX grouped progress complete."
