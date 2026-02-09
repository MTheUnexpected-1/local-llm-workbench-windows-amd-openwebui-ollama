. "$PSScriptRoot\common.ps1"

Initialize-InstallerLogging
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

$docker = "docker"

Write-InstallerLog "Pulling required images with visible progress."
Invoke-LoggedCommand -FilePath $docker -ArgumentList @("pull", "ollama/ollama:latest") -StepName "Pull ollama"
Invoke-LoggedCommand -FilePath $docker -ArgumentList @("pull", "ghcr.io/open-webui/open-webui:main") -StepName "Pull openwebui"

Write-InstallerLog "Building/pulling compose services for fileapi and stack dependencies."
Invoke-LoggedCommand -FilePath $docker -ArgumentList @("compose", "--env-file", $envFile, "-f", $composeFile, "pull") -StepName "Compose pull"

Write-InstallerLog "Running Test Stack step (compose up -d --build)."
Invoke-LoggedCommand -FilePath $docker -ArgumentList @("compose", "--env-file", $envFile, "-f", $composeFile, "up", "-d", "--build") -StepName "Test stack up"

Write-InstallerLog "Collecting container status after test stack startup."
$psOutput = & $docker compose --env-file $envFile -f $composeFile ps 2>&1
Write-InstallerLog "Compose ps:`n$psOutput"

Write-InstallerLog "Post-install stack validation completed successfully."
Write-InstallerLog "Installer logs are available at: $Global:InstallerLogFile"
