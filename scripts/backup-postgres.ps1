param(
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$EnvFile = ".env.production",
  [string]$OutputDir = "backups",
  [string]$PostgresUser = "cloak",
  [string]$PostgresDb = "cloak"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $OutputDir "cloak-postgres-$timestamp.sql"

& docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres pg_dump -U $PostgresUser -d $PostgresDb --clean --if-exists |
  Set-Content -Path $backupPath -Encoding utf8

Write-Output "Backup written: $backupPath"
