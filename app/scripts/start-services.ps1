param([string]$EnvFile)
$compose = Join-Path $PSScriptRoot "..\..\stack\docker-compose.yml"
docker compose --env-file $EnvFile -f $compose up -d --build
