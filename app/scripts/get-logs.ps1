param([string]$EnvFile, [string]$Service="openwebui")
$compose = Join-Path $PSScriptRoot "..\..\stack\docker-compose.yml"
docker compose --env-file $EnvFile -f $compose logs --tail 200 $Service
